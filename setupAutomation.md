# SFCC-ODS-Automation
Instructions and tools for automating the setup of ODS in Salesforce Commerce Cloud

These instructions are based on a raw bash approach to automating the creation and setup of an SFCC ODS. This should work in nearly any environment that supports these tools, and is kept simple for simplicity's sake.

This project assumes you _do not_ already have an existing ODS and are starting from scratch.

Special thanks to @Gektorian for the existing Docker repo: https://github.com/Gektorian/storefront-reference-architecture-docker

---

## Prerequisites and Dependencies
There are two dependencies to this project: `sfcc-ci` and `jq`

- `jq` is a command-line JSON parser: https://stedolan.github.io/jq/
- `sfcc-ci`: https://github.com/SalesforceCommerceCloud/sfcc-ci

---

## Account Manager

To make ODS setup and manipulation as pain-free and least-disruptive to your existing flows as possible, it is recommended to create two new entities in Account Manager:

- A new **USER** whose only role is "Sandbox API User".
- A new **API Client** dedicated to dealing with ODS, and needs the following settings.

The **USER** must have access to the appropriate _realm_. If any of the following permissions, screens, or drop-downs are missing, contact SFCC support to make sure ODS is enabled for your account and _your_ Account Manager user has permissions to access these changes.

Click "Add" to access the Roles list:
![Imgur](https://imgur.com/Qx8p85D.png)

Assign the "Sandbox API User" role, and hit "Add":
![Imgur](https://imgur.com/eEGu9dd.png)

You should see the following result:
![Imgur](https://imgur.com/hxOfiBt.png)

Change the scope of the role to allow access to your realm, and/or all Sandboxes for this User, by clicking on the blue funnel to the right:
![Imgur](https://imgur.com/uyqznkc.png)

Select the appropriate organization from the dropdown, and then select the realm and/or all Sandboxes option. Click Add:
![Imgur](https://imgur.com/uyqznkc.png)

Permissions should now look similar to this:
![Imgur](https://imgur.com/nWAdR0Q.png)

Make sure to hit the "Save" Button at the bottom once finished.

Apply the following settings to the **API Client**:
![Imgur](https://imgur.com/3eo4Oyn.png)

---

## Environment Setup
Once `sfcc-ci` and `jq` are installed, it's up to you to create either a `dw.json` file holding the credentials or a `.env` file to hold the same. Put whichever file you want in whatever folder you'll be working from. Here's an example `.env`:
```
SFCC_OAUTH_CLIENT_ID=<CLIENT-ID>
SFCC_OAUTH_CLIENT_SECRET=<CLIENT-PASSWORD>
SFCC_OAUTH_USER_NAME=<ACCOUNT-MANAGER-USER-NAME>
SFCC_OAUTH_USER_PASSWORD=<ACCOUNT-MANAGER-USER-PASSWORD>
SFCC_SANDBOX_API_POLLING_TIMEOUT=1000
```
The last line, `SFCC_SANDBOX_API_POLLING_TIMEOUT` changes the default timeout of `sfcc-ci` waiting for a response for the `sandbox:create` api call from 10 minutes to 1000 minutes. Sandboxes typically take ~6-7 minutes to create, so by upping to a value that won't time out, we should be in good shape. This is for the purpose of letting the `launch.sh` script run to completion.

---

## Scripts

`launch.sh`:
```
# Establish some variables
REALM=<REALM-ID>
SITENAME=<SITENAME> # This doesn't really matter except for output display purposes. Perhaps someone more clever than me can figure out how to *efficiently* list the contents of the SITEFILE and auto-extract the site names for pretty output
CODEFILE=<CODEFILE> # version1.zip
SITEFILE=<SITEFILE> # sfra.zip

# Create auth connection
echo "Establishing client auth credentials..."
sfcc-ci client:auth

# Create sandbox and store info in variable
echo "Creating sandbox... (this takes a few minutes, don't panic)"
SANDBOX_DATA=$(sfcc-ci sandbox:create --realm $REALM --ttl 0 --sync --json)

# Parse out our instance data
INSTANCE_HOST=$(echo $SANDBOX_DATA | jq -s -r '.[0].instance.host')
SANDBOX_ID=$(echo $SANDBOX_DATA | jq -s -r '.[0].sandbox.id')
BM_URL=$(echo $SANDBOX_DATA | jq -s -r '.[0].sandbox.links.bm')
echo $'\n\e[33mInstance Created: \e[1;33m'$INSTANCE_HOST$'\e[0m'
echo $'\e[33mSandbox ID: \e[1;33m'$SANDBOX_ID$'\e[0m\n'

# Deploy code to instance (activates automatically)
echo "Deploying and activating code on instance..."
sfcc-ci code:deploy $CODEFILE --instance $INSTANCE_HOST

# Deploy data to instance
echo "Deploying site ($SITENAME) to instance..."
sfcc-ci instance:upload $SITEFILE --instance $INSTANCE_HOST
echo "Importing site ($SITENAME) to instance..."
sfcc-ci instance:import $SITEFILE --instance $INSTANCE_HOST --sync --json | jq -r .exit_status.code

# Reindex site and rebuild urls - This is an example of launching a job post site import.
# Your use-case may vary, and the job must exist!
echo "Reindexing site..."
sfcc-ci job:run Reindex --instance $INSTANCE_HOST --sync --json | jq -r .exit_status.code
echo "Rebuilding URLs..."
sfcc-ci job:run RebuildURLs --instance $INSTANCE_HOST --sync --json | jq -r .exit_status.code

echo $'\n\e[1;32m'$BM_URL$'\e[0m\n'
```
Change the `<REALM-ID>` to a valid realm assigned and accesible to your Account Manager USER.

This script operates with two local files: `CODEFILE` and `SITEFILE`, which you should change in the starting variables to your locally available archives.

- `SITEFILE` is a **site** export from a working instance or archived build. This could be SFRA or anything else.
- `CODEFILE` is a **code** export from a working instance or archived compilation.

`CODEFILE` should follow the following format (for more information, run the command `sfcc-ci code:deploy --help`:
```
code_version.zip
    |-- code_version
      |-- cartridge1
      |-- cartridge2
      |-- cartridge3
```

If the existing site that you're importing has `data` OCAPI rules, you'll want to manipulate them in the import file located in `SITEFILE` prior to importing. This is necessary in order to append the OCAPI defaults `sfcc-ci` installs to allow it to communicate.

The default `sfcc-ci` OCAPI for the `data` scope is as follows. Be sure to replace `<CLIENT-ID>` with the `SFCC_OAUTH_CLIENT_ID` environment parameter value:
```
{
    "_v": "19.10",
    "clients": [{
        "client_id": "<CLIENT-ID>",
        "resources": [{
            "methods": ["get"],
            "read_attributes": "(**)",
            "write_attributes": "(**)",
            "resource_id": "/code_versions"
        }, {
            "methods": ["patch", "delete"],
            "read_attributes": "(**)",
            "write_attributes": "(**)",
            "resource_id": "/code_versions/*"
        }, {
            "methods": ["post"],
            "read_attributes": "(**)",
            "write_attributes": "(**)",
            "resource_id": "/jobs/*/executions"
        }, {
            "methods": ["get"],
            "read_attributes": "(**)",
            "write_attributes": "(**)",
            "resource_id": "/jobs/*/executions/*"
        }, {
            "methods": ["post"],
            "read_attributes": "(**)",
            "write_attributes": "(**)",
            "resource_id": "/sites/*/cartridges"
        }]
    }]
}
```

`delete.sh`:
```
# Create auth connection
echo "Establishing client auth credentials..."
sfcc-ci client:auth

# List sandboxes and store info in variable
echo "Listing sandboxes..."
SANDBOX_ID=$(sfcc-ci sandbox:list --json | jq -r .[0].id)

# Delete the sandbox
echo $'\e[31mDeleting Sandbox ID: \e[1;31m'$SANDBOX_ID$'\e[0m\n'
sfcc-ci sandbox:delete --sandbox $SANDBOX_ID --noprompt
```
This script operates on only the "first," or singular ODS, for convenience sake.
