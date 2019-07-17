var AWS = require('aws-sdk');
var jsforce = require('jsforce');

var username = '${SalesforceUsername}';
var password = '${SalesforcePassword}';

AWS.config.update({region: 'us-east-1'});
var kinesis = new AWS.Kinesis();
var conn = new jsforce.Connection();

conn.login(username, password, function(err, res) {
  if (err) { return console.error(err); }

  conn.streaming.topic('ContactUpdates').subscribe(function(message) {

    var params = {
      Data: Buffer.from(JSON.stringify(message.sobject)),
      PartitionKey: message.sobject.Id,
      StreamName: 'salesforce-updates'
    };
    return kinesis.putRecord(params).promise()
      .then((data) => {
        console.log("Message Sent");
      })
      .catch((err) => {
        console.error(err, err.stack);
      });
  });
});
