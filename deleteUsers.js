// delete users from Account Manager if they are in status DELETED or INITIAL
// this only works when authenticating via sfcc-ci with a username/password, not an API Key
// if you have multiple organizations you manage, be careful you're looking at the right one!

var exec = require('child_process').exec;
exec('sfcc-ci user:list -j', function(err, stdout, stderr) {
    const users = JSON.parse(stdout).content;
	for (i = 0; i < users.length; i++) {
		if (users[i].userState === 'DELETED' || users[i].userState === 'INITIAL') {
			exec('sfcc-ci user:delete -l ' + users[i].mail + ' -p -N', function(err, stdout, stderr) {
				console.log(stdout);
			})
		}
	}
});
