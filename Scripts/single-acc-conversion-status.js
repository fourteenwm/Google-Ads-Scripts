function main() {
  var query = "SELECT conversion_action.name, conversion_action.status FROM conversion_action";
  
  var report = AdsApp.report(query);
  var rows = report.rows();
  
  while (rows.hasNext()) {
    var row = rows.next();
    var conversionName = row['conversion_action.name'];
    var conversionStatus = row['conversion_action.status'];
    Logger.log('Conversion Action Name: ' + conversionName + ', Tracking Status: ' + conversionStatus);
  }
} 