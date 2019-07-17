#!/bin/bash
REGION=`curl http://169.254.169.254/latest/dynamic/instance-identity/document|grep region|awk -F\" '{print $4}'`
echo $REGION
cat > /home/ec2-user/setup.sh << EOF
# START ec2-user USERSPACE
echo "Setting up NodeJS Environment"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
echo 'export NVM_DIR="/home/ec2-user/.nvm"' >> /home/ec2-user/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm' >> /home/ec2-user/.bashrc
# Dot source the files to ensure that variables are available within the current shell
. /home/ec2-user/.nvm/nvm.sh
. /home/ec2-user/.profile
. /home/ec2-user/.bashrc
# Install NVM, NPM, Node.JS & Dependencies
nvm install 10.16.0
npm install jsforce
npm install aws-sdk
EOF

chown ec2-user:ec2-user /home/ec2-user/setup.sh && chmod a+x /home/ec2-user/setup.sh
sleep 1; su - ec2-user -c "/home/ec2-user/setup.sh"


cat > /home/ec2-user/producer.js << EOF
var AWS = require('aws-sdk');
var jsforce = require('jsforce');

var username = '${SalesforceUsername}';
var password = '${SalesforcePassword}';

AWS.config.update({region: '$REGION'});
var kinesis = new AWS.Kinesis();
var conn = new jsforce.Connection();

conn.login(username, password, function(err, res) {
  if (err) { return console.error(err); }

  conn.streaming.topic('ContactUpdated').subscribe(function(message) {

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
EOF

chown ec2-user:ec2-user /home/ec2-user/producer.js
sleep 1; su - ec2-user -c "/home/ec2-user/.nvm/versions/node/v10.16.0/bin/node /home/ec2-user/producer.js &"
