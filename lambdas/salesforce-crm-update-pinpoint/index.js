var AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION
});
var pinpoint = new AWS.Pinpoint();

exports.handler = async (event) => {
  var promises = [];
  event.Records.forEach((record) => {
    var contact = JSON.parse(new Buffer(record.kinesis.data, 'base64').toString('ascii'));

    if (contact.Email !== null) {
      promises.push(pinpoint.updateEndpoint({
        ApplicationId: process.env.PINPOINT_APPLICATION_ID,
        EndpointId: contact.Email,
        EndpointRequest: {
          Address: contact.Email,
          ChannelType: 'EMAIL',
          User: {
            UserId: contact.Id,
            UserAttributes: {
              'Salesforce_Contact_ID': [contact.Id],
              'Birthdate': [contact.Birthdate],
              'Name': [contact.Name]
            }
          }
        }
      }).promise());
    }

    if (contact.MobilePhone !== null) {
      promises.push(pinpoint.updateEndpoint({
        ApplicationId: process.env.PINPOINT_APPLICATION_ID,
        EndpointId: contact.MobilePhone,
        EndpointRequest: {
          Address: contact.MobilePhone,
          ChannelType: 'SMS',
          User: {
            UserId: contact.Id,
            UserAttributes: {
              'Salesforce_Contact_ID': [contact.Id],
              'Birthdate': [contact.Birthdate],
              'Name': [contact.Name]
            }
          }
        }
      }).promise());
    }
  });

  return Promise.all(promises)
    .then((results) => {
      console.log(`Updated ${results.length} Endpoints`);
      return 'Success';
    })
    .catch((err) => {
      console.error('Error Caught: ' + err);
      return 'Error';
    });

};
