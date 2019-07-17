var AWS = require('aws-sdk');
var jsforce = require('jsforce');

AWS.config.update({
  region: process.env.AWS_REGION
});
var pinpoint = new AWS.Pinpoint();

exports.handler = async (event) => {

  var conn = new jsforce.Connection();
  return conn.login(process.env.SALESFORCE_USERNAME, process.env.SALESFORCE_PASSWORD)
    .then(() => {

      var promises = [];

      event.Records.forEach((record) => {

        var payload = JSON.parse(new Buffer(record.kinesis.data, 'base64').toString('ascii'));
        var salesforce_field = null;
        var salesforce_field_value = null;

        if (payload.event_type === '_email.open') {
          salesforce_field = 'Pinpoint_Last_Email_Open__c';
          salesforce_field_value = payload.arrival_timestamp;
        } else if (payload.event_type === '_email.click') {
          salesforce_field = 'Pinpoint_Last_Email_Click__c';
          salesforce_field_value = payload.arrival_timestamp;
        } else if (payload.event_type === '_email.send') {
          salesforce_field = 'Pinpoint_Last_Email_Sent__c';
          salesforce_field_value = payload.arrival_timestamp;
        } else if (payload.event_type === '_email.open') {
          salesforce_field = 'Pinpoint_Last_Email_Open__c';
          salesforce_field_value = payload.arrival_timestamp;
        } else if (payload.event_type === '_email.unsubscribe') {
          salesforce_field = 'Pinpoint_Email_Unsubscribe__c';
          salesforce_field_value = payload.arrival_timestamp;
        } else if (payload.event_type === '_email.hardbounce') {
          salesforce_field = 'Pinpoint_Email_Hard_Bounce__c';
          salesforce_field_value = true;
        }

        if (salesforce_field !== null) {

          var promise = pinpoint.getEndpoint({
              ApplicationId: payload.application.app_id,
              EndpointId: payload.client.client_id
            })
            .promise()
            .then((data) => {

              var updateObject = {
                Id: data.EndpointResponse.User.UserId
              };
              updateObject[salesforce_field] = salesforce_field_value;

              return Promise.resolve(updateObject);

            });

          promises.push(promise);
        }
      });

      return Promise.all(promises)
        .then((salesforceContactUpdates) => {
          if (salesforceContactUpdates && salesforceContactUpdates.length > 0) {

            return conn.sobject('Contact').update(salesforceContactUpdates);
          }
          return Promise.resolve();
        });

    })
    .then((results) => {
      return 'Success';
    })
    .catch((err) => {
      console.error('Error Caught: ' + err);
      return 'Error';
    });

};
