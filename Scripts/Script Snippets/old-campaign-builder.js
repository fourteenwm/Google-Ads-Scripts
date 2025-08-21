function main() {
  
    var spreadsheet = SpreadsheetApp.openByUrl('https://docs.google.com/spreadsheets/d/17G1d90_2JOqpl6JYSpklbAHDQAje-_UlCbECS6d83kg/edit#gid=617527310');
    var accountIds = spreadsheet.getSheetByName("Campaign Builder").getSheetValues(6,2,(spreadsheet.getActiveSheet().getLastRow()-1),1);
    
    
    // Create variables to count delivery method.
    var standard = 0;
    var accelerated = 0;
    
    // Days of Week, excluding weekends.
    
    var weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  
    var delayInMilliseconds = 5000; //5 second
  
    // Columns to build our campaign with.
    
    var columns = [
     "Campaign", "Budget", "Bid Strategy type", "Campaign type", "Start Date", "End Date"
  ];
  
    // Remove then brackets around thne IDs.
   // accountIds = [].concat.apply([], accountIds);
  
   // for (i =0; i < accountIds.length; i++){
     // accountIds[i] = Number(accountIds[i]).toPrecision();
    //}
  
    var COLUMN = {
      accountname: 1,
      accountid: 2,
      campaignName: 3,
      address: 4,
      lat: 5,
      long: 6,
      radii: 7,
      startHour: 8,
      endHour: 9,
      startDate: 10,
      endDate: 11,
      budget: 12,
      negativeKeywords: 13,
      trackingtemplate: 14,
  };
    
    // Actual config (without header and margin) starts from this row
    var CONFIG_START_ROW = 6;
    
    // Every sheet should have this exact name.
    var sheet = spreadsheet.getSheetByName("Campaign Builder");
    
    var stateCell = sheet.getRange(2,2).getValue();
    var state = "";
    
    if (stateCell == 'TRUE'){
      state = 'enabled';
    }
    
    if (stateCell == 'FALSE'){
      state = 'paused';
    }
    
    
    var endRow = sheet.getLastRow();
  
    for (var i = CONFIG_START_ROW; i <= endRow; i++) {
      Logger.log('Processing row %s', i);
      
      var accountNameCell = sheet.getRange(i, COLUMN.accountname).getValue();
         
      // Variable representing the Campaign Name
      var campaignname = sheet.getRange(i, COLUMN.campaignName).getValue();
   
      // Variable representing the address.
      var location = sheet.getRange(i, COLUMN.address).getValue();
         
      // Variable representing the latitude.
      var latitude = sheet.getRange(i, COLUMN.lat).getValue();
      
      // Variable representing the longitude.
      var longitude = sheet.getRange(i, COLUMN.long).getValue();
      
      // Variable representing the radius.
      var radius = sheet.getRange(i, COLUMN.radii).getValue();
      
      // Variable representing the start hour for the ad scheduling.
      var start = sheet.getRange(i, COLUMN.startHour).getValue();
      
      // Variable representing the end hour for the ad scheduling.
      var end = sheet.getRange(i, COLUMN.endHour).getValue();
      
      // Variable representing the campaign end date..
      var endDate = sheet.getRange(i, COLUMN.endDate).getValue();
      
      // Variable representing the campaign end date..
      var startDate = sheet.getRange(i, COLUMN.startDate).getValue();
      
      // Variable representing the budget..
      var budget = sheet.getRange(i, COLUMN.budget).getValue();
      
      // Variable representing the negative keywords.
      var negativeKeywords = sheet.getRange(i, COLUMN.negativeKeywords).getValue();
      
      // Variable representing the tracking template
      var trackingTemplate = sheet.getRange(i, COLUMN.trackingtemplate).getValue();
     
      var accountId = sheet.getRange(i, COLUMN.accountid).getValue();
  
      var accountIter = MccApp.accounts().withIds([accountId]).get();
      var account = accountIter.next();
      MccApp.select(account);
      Logger.log("account name: " + account.getCustomerId());
  
      Logger.log(startDate);
  
      // Workaround using bulk uploader to auto-upload a new campaign to the account.
      
  //    var upload = AdWordsApp.bulkUploads().newCsvUpload(columns,{moneyInMicros: false});
  //    Logger.log("start: " + startDate);
  ///    Logger.log("end: " + endDate);
  
  //    var params = {
  //      'Campaign': campaignname,
   //     'Budget': budget,
  //      'Bid Strategy type': 'cpc',
  //      'Campaign type': 'Search Only',
  //      'Start Date': startDate,
  //      'End Date': endDate,
  //    };
      
  //    upload.append(params); 
   //   upload.forCampaignManagement(); 
   //   upload.apply();
  //    wait(7000);
      var spoof = "'" + campaignname + "'";
      Logger.log("Name = " + spoof + '"');
  
      var campaignIterator = AdWordsApp.campaigns()
      .withCondition("Name = " + spoof)
      .get();
      
      while (campaignIterator.hasNext()) {   
        Logger.log("got em");
      var campaign = campaignIterator.next();
        
         campaign.addAdSchedule({
            dayOfWeek: "MONDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "MONDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "MONDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "MONDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "MONDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
                  campaign.addAdSchedule({
            dayOfWeek: "TUESDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "TUESDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "TUESDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "TUESDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "TUESDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "WEDNESDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "WEDNESDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "WEDNESDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "WEDNESDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "WEDNESDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "THURSDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "THURSDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "THURSDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "THURSDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "THURSDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
                  campaign.addAdSchedule({
            dayOfWeek: "FRIDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "FRIDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "FRIDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "FRIDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "FRIDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
                  
          campaign.addAdSchedule({
            dayOfWeek: "SATURDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "SATURDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "SATURDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "SATURDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "SATURDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "SUNDAY",
            startHour: 0,
            startMinute: 0,
            endHour: 6,
            endMinute: 0,
          });  
          
          campaign.addAdSchedule({
            dayOfWeek: "SUNDAY",
            startHour: 6,
            startMinute: 0,
            endHour: 12,
            endMinute: 0,
          })
                  
          campaign.addAdSchedule({
            dayOfWeek: "SUNDAY",
            startHour: 12,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "SUNDAY",
            startHour: 17,
            startMinute: 0,
            endHour: 21,
            endMinute: 0,
          })
          
          campaign.addAdSchedule({
            dayOfWeek: "SUNDAY",
            startHour: 21,
            startMinute: 0,
            endHour: 24,
            endMinute: 0,
          })
        
     //  campaign.urls().setTrackingTemplate(trackingTemplate);
        
    //   Add the geo to the campaign.
      //  Logger.log("latitude: " + latitude);
       
     // campaign.addProximity(latitude, longitude, radius, "KILOMETERS");
        
      // Add the ad scheduling.
        
    //    for (y = 0; y < 5; y++) {
    //      campaign.addAdSchedule(weekDays[y], start, 0, end, 0);
    //    }
        
  //      JSON.stringify(negativeKeywords);
   //     var negativeKeywordArray = negativeKeywords.split(',');
        
   //     for (j = 0; j < negativeKeywordArray.length; j++){
  //        campaign.createNegativeKeyword(negativeKeywordArray[j]);
  //      }
      }
  
    }
    
  }
    
  // Get's the corrent month in String format.
  
  function getDateInStringFormat() {
  
    // Create 3 variables: a date, an array to store the month's variable numer and 
    var date = new Date(),
        monthsArray = [],
        month;
    
    monthsArray[0] = 'January';
    monthsArray[1] = 'February';
    monthsArray[2] = 'March';
    monthsArray[3] = 'April';
    monthsArray[4] = 'May';
    monthsArray[5] = 'June';
    monthsArray[6] = 'July';
    monthsArray[7] = 'August';
    monthsArray[8] = 'September';
    monthsArray[9] = 'October';
    monthsArray[10] = 'November';
    monthsArray[11] = 'December';
    
    month = monthsArray[date.getMonth()];
    
    return month;
    
  }
  
  // Convert date to string of format "YYYYMMDD"
  function dateToString(date) {
    return date.getFullYear() + zeroPad(date.getMonth() + 1) +
           zeroPad(date.getDate());
  }
  
  // Add leading 0 on month/day number with 1 digit
  function zeroPad(n) {
    if (n < 10) {
      return '0' + n;
    } else {
      return '' + n;
    }
  }
  
  
  function comparer(otherArray){
    return function(current){
      return otherArray.filter(function(other){
        return other.value == current.value && other.display == current.display
      }).length == 0;
    }
  }
  
  // Convert date to string of format "YYYYMMDD"
  function dateToString(date) {
    return date.getFullYear() + zeroPad(date.getMonth() + 1) +
           zeroPad(date.getDate());
  }
  
  function getCurrentMonth(){
    // Create 3 variables: a date, an array to store the month's variable numer and 
    var date = new Date(),
        monthsArray = [],
        month;
    
    monthsArray[0] = 'January';
    monthsArray[1] = 'February';
    monthsArray[2] = 'March';
    monthsArray[3] = 'April';
    monthsArray[4] = 'May';
    monthsArray[5] = 'June';
    monthsArray[6] = 'July';
    monthsArray[7] = 'August';
    monthsArray[8] = 'September';
    monthsArray[9] = 'October';
    monthsArray[10] = 'November';
    monthsArray[11] = 'December';
    
    month = monthsArray[date.getMonth()];
    
    return month;
  }
  
  function logSitelinks(entity) {
    var slIter = entity.extensions().sitelinks().get();
    while(slIter.hasNext()) {
      var sl = slIter.next();
      Logger.log('Id: ' + sl.getId() + ' Text: '+sl.getLinkText()+' Link: '+sl.getLinkUrl());
    }
  }
  
  function wait(ms){
     var start = new Date().getTime();
     var end = start;
     while(end < start + ms) {
       end = new Date().getTime();
    }
  }