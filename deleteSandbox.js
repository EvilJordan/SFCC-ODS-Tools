// if a sandbox's code hasn't been touched since `lastModified` and `deleteSandbox` is true, delete the sandbox
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
const path = '/on/demandware.servlet/webdav/Sites/Cartridges';
const day = 24 * 60 * 60 * 1000; // 24 hrs * 60 mins * 60 secs * 1000 milliseconds
const numDays = 30;
const lastModified = Date.now() - (day * numDays);
const deleteSandbox = false;
let i;
execSync('sfcc-ci client:auth ' + clientID + ' ' + clientPass); // log in
const sandboxes = JSON.parse(execSync('sfcc-ci sandbox:list -j'));
//console.log(sandboxes);
for (i = 1; i < sandboxes.length; i++) {
	const instance = sandboxes[i].instance;
	const sandboxID = sandboxes[i].id;
	const state = sandboxes[i].state;
	const url = 'https://' + realm + '-' + instance + hostname + path;
	const command = "curl -s --basic --user '" + user + ":" + pass + "' "+ url;
	exec(command, function(err, stdout, stderr) {
		const codeVersions = stdout.toString();
		if ((/Filename/gm).test(codeVersions)) { // we have access!
			//console.log(url);
			const matches = Array.from(codeVersions.matchAll(/(<td align="right"><tt>)(.+GMT)(<\/tt><\/td>)/gm), m => Date.parse(m[2]));
			//console.log(matches);
			let active = false;
			let oldCodeDate;
			let j;
			for (j = 0; j < matches.length; j++) {
				if (matches[j] > lastModified) {
					active = true;
					break;
				}
				oldCodeDate = new Date(matches[j]);
			}
			if (!active) {
				console.log(instance, 'has code older than ' + numDays + ' days!', oldCodeDate);
				if (deleteSandbox) {
					exec('sfcc-ci sandbox:delete -N -s ' + sandboxID, function(err, stdout, stderr) {
						console.log(stdout);
					});
				}
			}
		} else {
			const status = state !== 'started' ? ' (' + state + ')\t' + url.replace(path,'/on/demandware.store/Sites-Site') : '';
			console.log('Need access to', instance + status);
		}
	});
}
