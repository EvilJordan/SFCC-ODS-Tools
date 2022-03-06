// grab a list of all sandboxes, then look at each one to see if it has product catalogs
// if it doesn't, and the `deleteSandbox` flag is set to true, delete the sandbox (it was set up but never used)
// otherwise, output the date the catalog was last affected
// It's also possible the connecting user doesn't have access to the sandbox yet (SFCC needs a one-time manual login for an instance first)
// so, if that's the case, it will let you know.

var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
// TODO: change to use .env and yargs
const realm = REALM;
const clientID = CLIENTID;
const clientPass = CLIENTPASS;
const user = USERNAME;
const pass = USERPASS;
const hostname = '.sandbox.us01.dx.commercecloud.salesforce.com';
const catalogs = {
	'master': '/on/demandware.servlet/webdav/Sites/Catalogs/gamestop-master-catalog',
	'site': '/on/demandware.servlet/webdav/Sites/Catalogs/gamestop-site-catalog'
};
const deleteSandbox = false;
let i;
execSync('sfcc-ci client:auth ' + clientID + ' ' + clientPass); // log in
const sandboxes = JSON.parse(execSync('sfcc-ci sandbox:list -j'));
for (i = 1; i < sandboxes.length; i++) {
	var dates = [];
	const instance = sandboxes[i].instance;
	const sandboxID = sandboxes[i].id;
	const state = sandboxes[i].state;
	for (j = 0; j < Object.keys(catalogs).length; j++) {
		const thisCatalog = Object.keys(catalogs)[j];
		const url = 'https://REALM-' + instance + hostname + catalogs[thisCatalog];
		const command = "curl -s --basic --user '" + user + ":" + pass + "' "+ url;
		let stdout = execSync(command)
		const catalogDate = stdout.toString();
		if ((/Filename/gm).test(catalogDate)) { // we have access!
			const matches = Array.from(catalogDate.matchAll(/(<td align="right"><tt>)(.+GMT)(<\/tt><\/td>)/gm), m => Date.parse(m[2]));
			let data = {};
			let k;
			for (k = 0; k < matches.length; k++) {
				data[thisCatalog] = new Date(matches[k]).toDateString();
			}
			if ( Object.keys(data).length > 0) {
				dates.push(data);
			} else {
				console.log('No', thisCatalog, 'catalog on', instance);
			}
		} else {
			const status = state !== 'started' ? ' (' + state + ')\t' + url.replace(path,'/on/demandware.store/Sites-Site') : '';
			console.log('Need access to', instance + status);
			break;
		}
	}
	if (dates.length > 0) {
		console.log(instance, dates);
	} else {
		if (deleteSandbox) {
			console.log('Deleting', instance);
			exec('sfcc-ci sandbox:delete -N -s ' + sandboxID, function(err, stdout, stderr) {
				console.log(stdout);
			});
		}
	}
}
