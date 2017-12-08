# Chatbot
The Leave Bot has 2 main functions, one is to apply leave which is described in 1, and another one is to request leave entitlement and status as described in 2.
## 1. Apply leave 
Understand input intent as Apply Leave with input containing key words/sentence like "apply leave", "take leave", or "leave";
Trigger the leave application dialog as following:
1. Recognize input key words as several following entities:
Leave Type:
    Recognize 8 types of leave defined by Ministry of Manpower(MOM):
    Adoption Leave, Annual Leave, Childcare Leave, Maternity Leave, Paternity Leave, Shared Parental Leave, Sick Leave, Unpaid Infant Care Leave;
Leave Date: 
    Recognize 4 types of time input to get the leave start date and leave end date:
    Start date and end date, start date and leave duration, start date only, duration only;
1. Prompt for incomplete information
Leave Type
    Prompt for leave type selection when leave type information is missing;
Leave Date
    Ask user to input a date when leave starting or ending date information is missing;
    Give instructions when no date information recognized;
1. Prompt for checking information;
    Ask user to confirm the application information before sending request;
    Prompt for correcting information when information is wrong;
    Re-prompt for checking information after correction;
1. Send the request if information is correct;

## 2. Request leave entitlement and status
Understand user's intent as Requesting Leave Entitlements with input containing key words/sentences like "leave status";
Trigger the status request dialog as following:
- Send request to API to get user leave entitlement status;
- Return the status;

## 3. Help
Understand user's intent as Help with input containing key words/sentences like "Help";
Trigger the help dialog as following:
- Give instructions for the bot function and example sentences; 
- Prompt for selection of bot functions and give detailed instruction after selection.
