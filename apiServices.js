var https = require('https');

module.exports = {
    checkLeaveBalance: function (type, token) {
        return new Promise(function (resolve, reject) {
            var response = '';
            https.request({
                host: process.env.ApiServiceEndpoint,
                path: '/leavebalance' + (type ? `?type=${type}` : ''),
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            }, function (res) {
                res.setEncoding('utf8');
                if (res.statusCode === 200) {
                    res.on('data', function (buffer) {
                        response += buffer;
                    });
                    res.on('end', (err) => {
                        resolve(JSON.parse(response));
                    })
                }
            }).end();
        });
    },
    applyLeave: function (leaveApplicationRequest, token) {
        return new Promise(function (resolve, reject) {

            var req = https.request({
                host: process.env.ApiServiceEndpoint,
                path: '/leaveapplication',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    "Content-Type" :`application/json`
                }
            }, function (res) {
                res.setEncoding('utf8');
                if (res.statusCode === 200) {
                    res.on('data', function (buffer) {
                        response += buffer;
                    });
                    res.on('end', (err) => {
                        resolve(JSON.parse(response));
                    })
                }
            });
            req.write(JSON.stringify(leaveApplicationRequest));
            req.end();
        });
    }
}