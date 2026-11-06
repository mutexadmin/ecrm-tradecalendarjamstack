# Ontario.ca : Calendar of International Trade Events

Built with the [Ontario.ca Jamstack Toolkit](https://github.com/ongov/Ontario.ca-Jamstack-Toolkit) - see `README.jamstack` for more details.

## Application Build Process 

The trade event content of this application is sourced from the internal Microsoft Dynamics 365 CRM (often referred to as the eCRM) used by the business area in [MEDJCAT](https://www.ontario.ca/page/ministry-economic-development-job-creation-trade).

This data is exported once daily to a data warehouse operated by GSIC and made accessible to the application build process via a [Databricks](https://www.databricks.com/) SQL endpoint. Access is currently secured through an authentication token set as the environment variable `GSIC_WAREHOUSE_TOKEN`.

See `src/_data/app/tradeEvents.js` for the full code that pulls from the data warehouse, processes the event data, and makes it available via the [Eleventy Data Cascade](https://www.11ty.dev/docs/data-cascade/).

## Automatic Build and Release Schedule

The application is rebuilt and redeployed once daily to pick up changes to the event data. The scheduled jobs take place just after 10:00 AM EST, to coincide with the data export finishing around 9:30 AM EST.

[The pipeline schedule is here](https://git.ontariogovernment.ca/ontario.ca/trade-calendar/trade-calendar-jamstack/-/pipeline_schedules) and uses standard GitLab CI.

## Guidelines for Entering Event Descriptions in the Dynamics 365 CRM

When entering event descriptions into the eCRM, follow the formatting rules in the example below to allow the content to be rendered well in the Trade Calendar application on Ontario.ca:

```
This is a well-formatted example entry. Each paragraph should be on its own line, and this is the first paragraph.

This is the second paragraph.

A numbered list should be entered like this:
1. Numbered List Item 1
2. Numbered List Item 2
3. Numbered List Item 3

An unnumbered list should be entered like this:
* Unnumbered List Item 1
* Unnumbered List Item 2
* Unnumbered List Item 3
```

Do not use tabs or extra spaces to create layouts or lists - enter the content in the style above and the application will render it in the standard Ontario.ca appearance.
