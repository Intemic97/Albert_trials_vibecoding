const fs = require('fs');
let lines = fs.readFileSync('components/Workflows.tsx', 'utf8').split('\n');

// Dead state variable names to remove (from analysis)
const deadNames = new Set([
  'conditionProcessingMode', 'additionalConditions', 'conditionLogicalOperator',
  'connectingFromType', 'addFieldName', 'addFieldValue',
  'llmContextEntities', 'llmIncludeInput', 'llmProcessingMode',
  'splitColumnsAvailable', 'splitColumnsOutputA', 'splitColumnsOutputB', 'draggedColumn',
  'manualInputVarName', 'manualInputVarValue',
  'mysqlHost', 'mysqlPort', 'mysqlDatabase', 'mysqlUsername', 'mysqlPassword',
  'sapConnectionName', 'sapAuthType', 'sapClientId', 'sapClientSecret',
  'sapTokenUrl', 'sapBaseApiUrl', 'sapServicePath', 'sapEntity',
  'emailSubject', 'emailBody', 'emailSmtpHost', 'emailSmtpPort', 'emailSmtpUser', 'emailSmtpPass',
  'smsBody', 'twilioAccountSid', 'twilioAuthToken', 'twilioFromNumber', 'showSMSTwilioSettings',
  'whatsappBody', 'whatsappTwilioAccountSid', 'whatsappTwilioAuthToken',
  'whatsappTwilioFromNumber', 'showWhatsAppTwilioSettings',
  'showWidgetExplanation', 'showEmailSmtpSettings',
  'opcuaEndpointUrl', 'opcuaNodeId', 'opcuaUsername', 'opcuaPassword',
  'opcuaSecurityMode', 'opcuaSecurityPolicy', 'opcuaPollInterval',
  'mqttBrokerUrl', 'mqttPort', 'mqttTopic', 'mqttUsername', 'mqttPassword',
  'mqttClientId', 'mqttQos', 'mqttCleanSession',
  'osiPiHost', 'osiPiApiKey', 'osiPiGranularityValue', 'osiPiGranularityUnit',
  'osiPiWebIds', 'showOsiPiApiKey',
  'franmitApiSecretId', 'franmitReactorVolume', 'franmitReactionVolume',
  'franmitCatalystScaleFactor', 'showFranmitApiSecret',
  'conveyorWidth', 'conveyorInclination', 'conveyorLoadCapacity',
  'conveyorBeltType', 'conveyorMotorPower', 'conveyorFrictionCoeff',
  'esiosDate', 'selectedApproverUserId', 'isLoadingUsers',
  'limsQuery', 'statisticalParams', 'alertRecipients',
  'pdfReportData', 'pdfOutputPath',
]);

let removed = 0;
const newLines = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/const \[(\w+), set\w+\] = useState/);
  if (m && deadNames.has(m[1])) {
    removed++;
    // Skip blank line after if present
    if (i + 1 < lines.length && lines[i + 1].trim() === '') {
      // Don't add next blank line either
      i++;
    }
    continue;
  }
  newLines.push(lines[i]);
}

fs.writeFileSync('components/Workflows.tsx', newLines.join('\n'));
console.log('Removed', removed, 'dead useState declarations');
console.log('New file size:', newLines.length, 'lines');

