
exports.handler = async (event) => {
  console.log(JSON.stringify(event));

  var today = new Date();

  var birthdaysToday = Object.keys(event.Endpoints)
    .filter(endpointId => {
      var bday = new Date(event.Endpoints[endpointId].User.UserAttributes.Birthdate);
      return bday.getMonth() === today.getMonth() && bday.getDay() === today.getDay();
    })
    .reduce((filtered, endpointId) => {
      filtered[endpointId] = event.Endpoints[endpointId];
      return filtered;
    }, {});

    console.log('Found ' + Object.keys(birthdaysToday).length + ' Endpoints with Birthday Today!');
    return birthdaysToday;
};
