## Amazon Pinpoint Salesforce Connector Demo

Drive richer segmentation, targeting, and personalization with Amazon Pinpoint by creating a realtime sync to Salesforce CRM.  Additionally, sync Pinpoint Engagement event data back to Salesforce CRM in realtime to enable Sales Cloud users the ability to see which Contacts are engaged.

## Use Case

As a marketer, you want to ensure that your email, phone, and SMS contact information stays up to date with your Salesforce CRM instance where the rest of your organization manages this data.  If a customer's email address changes, as an example, you need to know in real time to ensure high deliverability and engagement through your marketing campaigns.  Additionally, as new CRM Contacts are added, you want the ability to incorporate them into nurture campaigns immediately without manual uploading of files.

As a Salesforce CRM user, you want to see engagement data for each customer on the CRM Contact record.  This provides you with a better understanding of how the customer is engaging with your brand and helps to avoid contact fatigue across multiple channels.  

Keeping your Marketing and Sales data in sync with each other allows both organizations to get insight into the 360 degree view of the customer.

## Architecture
![Screenshot](images/arch.png)

## Repository content
Main files:
```bash
.
├── README.MD                                           <-- This instructions file
├── cloudformation                                      <-- Folder for the AWS CloudFormation Templates
│   └── salesforcedemo.template.yaml                    <-- AWS CloudFormation Template to setup the sync
│   └── ec2-userdata.sh                                 <-- User Data script to connect to the Salesforce Streaming API
│   └── birthdaycampaign.template.yaml                  <-- AWS CloudFormation Template for the Happy Birthday Campaign
├── lambdas                                             <-- Folder for the AWS Lambda Function code
│   └── salesforce-crm-update-pinpoint                  <-- Folder for Amazon Pinpoint Update Code
│       └── index.js                                    <-- AWS Lambda Function code to update Amazon Pinpoint Endpoints
│       └── package.json                                <-- NPM Package manifest
│       └── salesforce-crm-update-pinpoint.zip          <-- Pre-packaged AWS Lambda code with dependencies
│   └── pinpoint-engagement-update-salesforce           <-- Folder for Salesforce Update Code
│       └── index.js                                    <-- AWS Lambda function code to update Salesforce Contact Objects
│       └── package.json                                <-- NPM Package manifest
│       └── pinpoint-engagement-update-salesforce.zip   <-- Pre-packaged AWS Lambda code with dependencies
│   └── pinpoint-birthday-segment-filter                <-- Folder for Custom Amazon Pinpoint Segment Filter
│       └── index.js                                    <-- AWS Lambda function code to filter for birthdays today
├── salesforce-stream-producer                          <-- Folder for the EC2 code to connect to the Salesforce Streaming API
│   └── producer.js                                     <-- Node code for the Salesforce Streaming API
```


## Prerequisites

You need the following:

* A Salesforce Sales Cloud Organization
   * [Streaming API](https://developer.salesforce.com/docs/atlas.en-us.api_streaming.meta/api_streaming/intro_stream.htm) enabled
   * [Developer Console](https://help.salesforce.com/articleView?id=code_dev_console.htm&type=5) access
   * User permissions to add Custom Fields to the Contact Object
* A computer with node and npm installed.

* An AWS account with sufficient permissions to create the resources shown in the diagram in the earlier section. For more information about creating an AWS account, see [How do I create and activate a new Amazon Web Services account?](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/).
* An Amazon EC2 key pair. You need this to log into the EC2 instance if you want to modify the Twitter handle that you're monitoring. For more information, see [Creating a Key Pair Using Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html#having-ec2-create-your-key-pair).
* The AWS Command Line Interface (AWS CLI) installed and configured on your macOS-based computer. For information about installing the AWS CLI, see [Installing the AWS Command Line Interface](https://docs.aws.amazon.com/cli/latest/userguide/installing.html). For information about setting up the AWS CLI, see [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).


### Setup
#### Step 1: Create a PushTopic for the Salesforce Streaming API

The first step is to setup the target Salesforce CRM organization to start streaming Contact events.  The following steps use the Salesforce Developer Console to execute Apex code.

1. Log into your Salesforce instance and open the Developer Console
2. Click **Debug | Open Execute Anonymous Window**
3. In the Enter Apex Code window, paste the following Apex code, and click **Execute**

```PushTopic pushTopic = new PushTopic();
pushTopic.Name = 'ContactUpdates';
pushTopic.Query = 'SELECT Id, Name, Email, MobilePhone, Birthdate FROM Contact';
pushTopic.ApiVersion = 46.0;
pushTopic.NotifyForOperationCreate = true;
pushTopic.NotifyForOperationUpdate = true;
pushTopic.NotifyForOperationUndelete = true;
pushTopic.NotifyForOperationDelete = true;
pushTopic.NotifyForFields = 'Referenced';
insert pushTopic;
```

![Screenshot](images/pushtopic.png)

#### Step 2: Modify the Salesforce CRM Contact Object with Custom Fields

1. Log into your Salesforce instance and access **Setup | Object Manager**
2. Select the Contact object in the list of Objects
3. Select **Fields & Relationships** from the left menu
4. For each field below, follow these steps to create a custom field
    1. Click **New**
    2. Select the Field's Data type and Select **Next**
    3. Minimally provide the **Field Label** and **Field Name** and Select **Next**
    4. Select which Profiles will be able to see the field.  *Recommendation - Check the **Read-Only** header to ensure only the API can modify the values.*  Select **Next**
    5. Select which page layouts will display the new field and Select **Save**

**Fields**

| Field Label | Field Name | Datatype |
| ----------- | ---------- | -------- |
| Pinpoint Last Email Open | Pinpoint_Last_Email_Open | Date/Time |
| Pinpoint Last Email Sent | Pinpoint_Last_Email_Sent | Date/Time |
| Pinpoint Last Email Click | 	Pinpoint_Last_Email_Click | Date/Time |
| Pinpoint Email Unsubscribe | Pinpoint_Email_Unsubscribe | Checkbox |
| Pinpoint Email Hard Bounce | Pinpoint_Email_Hard_Bounce | Checkbox |

When finished, it should look similar to this:  
*NOTE - Salesforce adds "__c" to designate Custom Fields*
![Screenshot](images/objectmanager.png)


#### Step 3: Prepare the AWS Lambda Zip Functions

The AWS Lambda functions utilize the [JSforce](https://jsforce.github.io/) JavaScript Library to connect to Salesforce to read the Streaming API and make Contact Object updates.  This dependency requires us to deploy our AWS Lambda functions in a packaged zip.  Fully functional zip packages are already provided, but need to be deployed into Amazon S3 in order for the CloudFormation template to run properly.

*Optional*, the full zip file deployment packages are included in this git repository, however, to create your own packages follow these steps:

1. Open the */lambdas/pinpoint-engagement-update-salesforce* folder
2. Run *npm --install* to automatically create a *node_modules* folder and download all needed dependencies
3. Package the the folder contents into a zip file.  Ex: *zip -r package.zip .*
4. Repeat for the */lambdas/salesforce-crm-update-pinpoint* folder

To upload the zip deployment packages:

1. Sign in to the AWS Management Console, and then open the Amazon S3 console at https://s3.console.aws.amazon.com/s3/home.
2. Choose **Create bucket** to create a new AWS Lambda deployment container bucket.
3. Give the bucket a globally unique name and then click **Create**.
4. Select the newly created bucket to open it up.
5. Drag the two AWS Lambda Zip packages from the Git repo code to Amazon S3 to upload them to the bucket.
  1. salesforce-crm-update-pinpoint.zip located in the */lambdas/salesforce-crm-update-pinpoint/* folder.
  2. pinpoint-engagement-update-salesforce.zip located in the */lambdas/pinpoint-engagement-update-salesforce/* folder.
6. Ensure to note the Amazon S3 bucket name and the Amazon S3 keys for both Zip files as they will be needed in the next step to configure the AWS CloudFormation Template.

#### Step 4: Launch the AWS CloudFormation template

Now we can launch the AWS CloudFormation template that sets up the backend components that power this solution.  The AWS CloudFormation Template **salesforcedemo.template.yaml** can be found in the **cloudformation** folder of this git repostiory.

To launch the AWS CloudFormation template:

1. Sign in to the AWS Management Console, and then open the AWS CloudFormation console at https://console.aws.amazon.com/cloudformation/home.
2. Choose **Create stack**.
3. Next to **Specify template**, choose **Upload a template file**, and then choose **Choose file** to upload the **salesforcedemo.template.yaml** template file. Choose **Next**.
4. Under **Specify stack details**, for **Stack Name**, type a name for the CloudFormation stack.
5. Under **Parameters**, do the following:
    1. For **SalesforceUsername**, type your Salesforce API User username.
    2. For **SalesforcePassword**, type your Salesforce API User password - note, depending on your settings, a [Salesforce Security Token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5) may be required.
    3. For **KeyName**, type the Amazon EC2 Key Pair key name of an existing key pair.
    4. For **S3DeploymentBucket**, type Amazon S3 deployment bucket created in Step 3.
    5. For **S3KeyLambda1**, type the Amazon S3 key for salesforce-crm-update-pinpoint.zip.
    6. For **S3KeyLambda2**, type the Amazon S3 key for pinpoint-engagement-update-salesforce.zip.
6. Choose **Next**.
7. On the next page, review your settings, and then choose **Next** again. On the final page, select the box to indicate that you understand that AWS CloudFormation will create IAM resources, and then choose **Create**.

When you choose **Create**, AWS CloudFormation creates the all of the backend components for the application. These include a Pinpoint Application, an EC2 instance, two Kinesis data streams, a Kinesis Firehose delivery stream, an S3 bucket, and two Lambda functions. This process takes about 10 minutes to complete.

#### Step 5. Test the Salesforce CRM to Amazon Pinpoint Endpoint Connection

At this point, there will be an EC2 instance listening to Salesforce Contact updates on the Salesforce Streaming API.  As changes happen, in real time, the EC2 code will capture the event and pass it to the Amazon Kinesis Stream.  The **salesforce-crm-update-pinpoint** AWS Lambda code will then execute and write the Salesforce Contact object into Pinpoint using Endpoint and User data.  The UserId of the Endpoint data will be the Salesforce CRM Contact Id.  In this way, the Email and MobilePhone endpoints will be tied back to the same user.  The Name and Birthdate fields will be written as custom User Attributes that can be used for segmentation and personalization of messages.

To test the connection, first we need to create a new Contact in Salesforce.

1. Log into your Salesforce instance.
2. Choose **Contacts** from the navigation menu.
3. On the Contacts page Choose **New**.
4. Fill out the **New Contact** form ensuring to fill in all Required Fields, the **Mobile** and **Email** fields, as well as the **Birthdate** field for Step 7 below.
5. Choose **Save**

To verify the Endpoints were created for both the email and mobile phone fields:

1. Log in to the AWS console, and then open the Amazon Pinpoint console at https://console.aws.amazon.com/pinpoint/home/.
2. From the **All Projects** menu, choose **Salesforce Pinpoint Demo Application**.
3. The **Applications analytics** should now display **2** under **New endpoints**.

#### Step 6. Test the Amazon Pinpoint Engagement Update to Salesforce CRM

Now that we have verified that Salesforce CRM updates are syncing into Amazon Pinpoint in realtime, we need to verify that Pinpoint engagement data is syncing back to Salesforce CRM. To do this, we need to enable the Email channel in the **Salesforce Pinpoint Demo Application**.

To enable the Email Channel:

1. In the navigation pane, choose **Settings** while still on the **Salesforce Pinpoint Demo Application** in Amazon Pinpoint.
2. Under **Email** choose **Manage**.
3. Under **Identity details** choose **Edit**.
4. Check the box **Enable the email channel for this project**.
    1. Choose **Verify a new email address**.
    2. Enter an email address that you have access to in the **Email address** field.
    3. Choose **Verify email address**
    4. Check your email for a verification email and follow the instructions.
    5. Choose **Save**
5. Take note of the **Sending Restrictions** information.  If it says **In sandbox** then you will only be able to send emails to email addresses you verified in the steps above. If this is the case, ensure that your Salesforce Contact uses this email address or the send will fail.

To execute an email campaign:

1. In the navigation pane, choose **Campaigns** while still on the **Salesforce Pinpoint Demo Application** in Amazon Pinpoint.
2. Choose **Create a campaign**.
3. For **Campaign name**, type a name for the campaign, and then choose **Next**.
4. On the **Segment** page, do the following
    1. Choose **Create a segment**.
    2. For **Name your segment to reuse it later**, type a name for the segment.
    3. Note that under **Segment Estimate** ensure that it lists **2 endpoints**.
    4. Leave the other settings as default and choose **Next**.
    5. Choose **I understand** on the pop-up menu warning.
5. On the **Create your message** page, ensure **Email** is chosen and type the message that you want to send, and then choose **Next**.
6. On the **Schedule** page, choose **At a specific time** and **Immediately** and then choose **Next**.
7. Verify that you receive your message in your email inbox.

To verify that the Amazon Pinpoint engagement data makes it back to the Salesforce Contact record:

1. Wait a few moments for the events in the Kinesis Event Stream to be fully processed by the AWS Lambda function.
2. Log into your Salesforce instance.
3. Choose **Contacts** from the navigation menu.
4. Find and open your test Contact record.
5. Click **Details** to view the Contact record field details.
6. Verify that the **Pinpoint Last Email Sent** field has been updated!


#### Step 7. Take it to the next level - Create a Happy Birthday Email Campaign

Now that we are syncing Contact data from Salesforce CRM to Amazon Pinpoint, we can use this data to power all kinds of marketing campaigns. A very simple campaign we will setup now is a Happy Birthday email campaign using the Birthdate field in Salesforce CRM.  We will launch a Daily recurring Pinpoint Campaign that will utilize an AWS Lambda function to filter down our Endpoints to find only those with Today as their Birthday using a Pinpoint Campaign Server Extension.  All of these components have been packaged into the AWS CloudFormation template **birthdaycampaign.template.yaml** file found in the **cloudformation** folder of this git repository.

*Note* the AWS Lambda code found in */lambdas/pinpoint-birthday-segment-filter* is only a handful of lines long and does not require any third party dependencies, so the full source is included in the AWS CloudFormation template and does not require an AWS Lambda deployment package to be uploaded to S3 like Step 3 above.

To launch the AWS CloudFormation template:

1. Sign in to the AWS Management Console, and then open the AWS CloudFormation console at https://console.aws.amazon.com/cloudformation/home.
2. Choose **Create stack**.
3. Next to **Specify template**, choose **Upload a template file**, and then choose **Choose file** to upload the **birthdaycampaign.template.yaml** template file. Choose **Next**.
4. Under **Specify stack details**, for **Stack Name**, type a name for the CloudFormation stack.
5. Under **Parameters**, do the following:
    1. For **ApplicationId**, type your Pinpoint Application Id that was created in Step 4 to reuse the same Pinpoint Application.
    2. For **CampaignEndTime**, type the Date and Time that you would like this Campaign to end in UTC. Ex: 2025-07-20T15:53:00
    3. For **CampaignStartTime**, type the Date and Time that you would like this Campaign to start in UTC. Ex: 2025-07-20T15:53:00
6. Choose **Next**.
7. On the next page, review your settings, and then choose **Next** again. On the final page, select the box to indicate that you understand that AWS CloudFormation will create IAM resources, and then choose **Create**.

When you choose **Create**, AWS CloudFormation creates the all of the backend components for the application. These include a Pinpoint Segment of ALL Endpoints, a Pinpoint Campaign that will run Daily, and two Lambda functions. This process takes about 5 minutes to complete.


## Troubleshooting
1. CRM updates are not updating Amazon Pinpoint Endpoints.
    * Did the Kinesis producer script crash? Log into EC2 instance and view logs to troubleshoot.
    * Did the AWS Lambda function error? Log into Amazon CloudWatch to view the detailed Lambda logs to troubleshoot.
2. Amazon Pinpoint engagement data is not updating in Salesforce CRM.
    * Did the AWS Lambda function error? Log into Amazon CloudWatch to view the detailed Lambda logs to troubleshoot.

## License Summary

This sample code is made available under a modified MIT license. See the LICENSE file.
