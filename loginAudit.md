```bash
curl -s --user 'USERNAME:PASSWORD' https://SANDBOX.dx.commercecloud.salesforce.com/on/demandware.servlet/webdav/Sites/Securitylogs | grep -o '\/on\/demandware\.servlet\/webdav\/Sites\/Securitylogs\/security\-ecom-[^"]*' | xargs -I {} curl -s --user USERNAME:PASSWORD https://SANDBOX.dx.commercecloud.salesforce.com{} | grep -e 'authentication successful' | grep -ve 'USERNAME' | sed 's/\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\)\(\.[0-9]\{3\}\)/\1/' | sort -r | uniq | head -n25 | grep -Eo "(\[.+GMT\])|'([^']+)'" | tr "'" ' ' | tr -d '\n' | sed 's/\[/\n\[/g'
```

1. Connect to webdav with username and password, silence any curl-related output, and list the Securitylogs directory (listing is the default behavior of connecting to webdav)
2. Filter out only matches for the security-ecom files and output them to STDOUT
3. Send those matching filenames to another curl command that calls the webdav URL again and outputs the file contents to STDOUT
4. Filter the STDOUT lines by "authentication successful"
5. Filter the "authentication successful" lines to those that *do not* include the connecting user's login
6. Modify the timestamp to remove milliseconds
7. Sort the results in descending order (latest first)
8. Filter for unique results
9. Print the first 25 lines - this is optional, maybe you want everything, idk!
10. Extract the date and user that logged in
11. Replace the single quotes with spaces
12. Replace the newlines betwen the date and user
13. Add newlines for each entry

Example output:

```
[2021-12-07 07:18:00 GMT] user@domain.com 
[2021-12-06 11:27:32 GMT] user@domain.com 
[2021-12-06 11:21:32 GMT] user@domain.com 
```

One could throw this into a BASH script with `USERNAME` and `PASSWORD` as constants, and then `SANDBOX` as an array to loop through and automate the spitting out of a report:

```bash
declare -a INSTANCES=("realm-001.sandbox.us01.dx.commercecloud.salesforce.com" "realm-002.sandbox.us01.dx.commercecloud.salesforce.com" "realm-003.sandbox.us01.dx.commercecloud.salesforce.com") # space separated list of sandbox hostnames

USERNAME=USERNAME
PASSWORD=PASSWORD

for SANDBOX in "${INSTANCES[@]}"
do
	curl -s --user $USERNAME':'$PASSWORD https://$SANDBOX/on/demandware.servlet/webdav/Sites/Securitylogs | grep -o '\/on\/demandware\.servlet\/webdav\/Sites\/Securitylogs\/security\-ecom-[^"]*' | xargs -I {} curl -s --user $USERNAME':'$PASSWORD https://$SANDBOX{} | grep -e 'authentication successful' | grep -ve "'"$USERNAME"'" | sed 's/\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\)\(\.[0-9]\{3\}\)/\1/' | sort -r | uniq | head -n25 | grep -Eo "(\[.+GMT\])|'([^']+)'" | tr "'" ' ' | tr -d '\n' | sed 's/\[/\n\[/g' > $SANDBOX'.txt'
done
```
