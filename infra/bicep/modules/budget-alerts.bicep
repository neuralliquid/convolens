// =============================================================================
// Budget Alerts Module
// =============================================================================
// Creates Azure Cost Management budgets with alerts for cost monitoring.
// Sends notifications when spending approaches or exceeds thresholds.
// =============================================================================

@description('Name of the budget')
param name string

@description('Budget amount in USD')
param amount int

@description('Email addresses to receive alerts')
param contactEmails array

@description('Resource group name for scope')
param resourceGroupName string = resourceGroup().name

@description('Environment (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Tags to apply to the budget')
param tags object = {}

@description('Budget time grain (Monthly, Quarterly, Annually)')
@allowed(['Monthly', 'Quarterly', 'Annually'])
param timeGrain string = 'Monthly'

@description('Current date for budget calculation (passed from parent to ensure consistency)')
param currentDate string = utcNow('yyyy-MM-01')

// Derive startDate from the single currentDate value to avoid race conditions
var startDate = currentDate

// =============================================================================
// Variables
// =============================================================================

// Environment-specific thresholds
var thresholds = environment == 'prod' ? {
  warning: 50
  alert: 75
  critical: 90
  exceeded: 100
} : environment == 'staging' ? {
  warning: 60
  alert: 80
  critical: 95
  exceeded: 100
} : {
  warning: 70
  alert: 85
  critical: 100
  exceeded: 110
}

// =============================================================================
// Resources
// =============================================================================

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: name
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: timeGrain
    timePeriod: {
      startDate: startDate
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [resourceGroupName]
      }
    }
    notifications: {
      // Warning notification (50-70% depending on env)
      warningNotification: {
        enabled: true
        operator: 'GreaterThan'
        threshold: thresholds.warning
        thresholdType: 'Actual'
        contactEmails: contactEmails
        contactRoles: ['Owner', 'Contributor']
        locale: 'en-us'
      }
      // Alert notification (75-85% depending on env)
      alertNotification: {
        enabled: true
        operator: 'GreaterThan'
        threshold: thresholds.alert
        thresholdType: 'Actual'
        contactEmails: contactEmails
        contactRoles: ['Owner', 'Contributor']
        locale: 'en-us'
      }
      // Critical notification (90-100% depending on env)
      criticalNotification: {
        enabled: true
        operator: 'GreaterThan'
        threshold: thresholds.critical
        thresholdType: 'Actual'
        contactEmails: contactEmails
        contactRoles: ['Owner']
        locale: 'en-us'
      }
      // Exceeded notification (100-110% depending on env)
      exceededNotification: {
        enabled: true
        operator: 'GreaterThan'
        threshold: thresholds.exceeded
        thresholdType: 'Actual'
        contactEmails: contactEmails
        contactRoles: ['Owner']
        locale: 'en-us'
      }
      // Forecasted threshold notification
      forecastedNotification: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
        contactRoles: ['Owner', 'Contributor']
        locale: 'en-us'
      }
    }
  }
}

// =============================================================================
// Outputs
// =============================================================================

output budgetName string = budget.name
output budgetAmount int = amount
output thresholds object = thresholds
