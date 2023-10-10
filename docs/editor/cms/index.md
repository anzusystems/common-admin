# CMS status

- `Feature clear` - all features are clear to developer, no missing product or technical requirements
- `Schema setup` - simple schema setup done on collaboration and editor side to display migrated data and validate migrated data schema
- `Development` - Feature done by developer and merged (admin + BE, not WEB)
- `Migration valid` - checked migrated examples for valid json
- `Docs` - feature/node/mark/extension is documented here
- `Feature done` - CMS release feature set done

## Marks
| Name        | Feature clear | Schema setup | Development | Migration valid | Docs | Feature done |
|-------------|:-------------:|:------------:|:-----------:|:---------------:|------|:------------:|
| bold        |       ✅       |      ✅       |     dep     |                 |      |              |
| italic      |       ✅       |      ✅       |     dep     |                 |      |              |
| link        |       ✅       |      ✅       |      ✅      |                 |      |              |
| strike      |       ✅       |      ✅       |     dep     |                 |      |              |
| subscript   |       ✅       |      ✅       |     dep     |                 |      |              |
| superscript |       ✅       |      ✅       |     dep     |                 |      |              |
| underline   |       ✅       |      ✅       |     dep     |                 |      |              |

## Nodes
| Name             | Feature clear | Schema setup | Development | Migration valid | Docs | Feature done |
|------------------|:-------------:|:------------:|:-----------:|:---------------:|------|:------------:|
| quote            |       ✅       |      ✅       |      ✅      |                 |      |              |
| bulletList       |       ✅       |      ✅       |     dep     |                 |      |              |
| button           |       ✅       |      ✅       |      ✅      |                 |      |              |
| contentBreak     |       ✅       |      ✅       |             |                 |      |              |
| contentLock      |       ✅       |      ✅       |      ✅      |                 |      |              |
| doc              |       ✅       |      ✅       |     dep     |                 |      |              |
| embedCustom      |       ✅       |      ✅       |             |                 |      |              |
| embedGallery     |       ✅       |      ✅       |             |                 |      |              |
| embedImage       |       ✅       |      ✅       |             |                 |      |              |
| embedImageInline |       ✅       |      ✅       |             |                 |      |              |
| embedCrossBox    |               |              |             |                 |      |              |
| embedFaq         |               |      ✅       |             |                 |      |              |
| embedMedia       |               |      ✅       |             |                 |      |              |
| embedNewsletter  |               |              |             |                 |      |              |
| embedPoll        |       ✅       |      ✅       |             |                 |      |              |
| embedQuiz        |       ✅       |      ✅       |             |                 |      |              |
| embedRelated     |       ✅       |      ✅       |             |                 |      |              |
| embedTimeline    |               |              |             |                 |      |              |
| embedWeather     |       ✅       |      ✅       |             |                 |      |              |
| hardBreak        |       ✅       |      ✅       |     dep     |                 |      |              |
| heading          |       ✅       |      ✅       |     dep     |                 |      |              |
| horizontalRule   |       ✅       |      ✅       |     dep     |                 |      |              |
| listItem         |       ✅       |      ✅       |     dep     |                 |      |              |
| orderedList      |       ✅       |      ✅       |     dep     |                 |      |              |
| paragraph        |       ✅       |      ✅       |     dep     |                 |      |              |
| review           |               |              |             |                 |      |              |
| styledBox        |       ✅       |      ✅       |      ✅      |                 |      |              |
| table            |       ✅       |      ✅       |   dep + ✅   |                 |      |              |
| tableCell        |       ✅       |      ✅       |     dep     |                 |      |              |
| tableHeader      |       ✅       |      ✅       |     dep     |                 |      |              |
| tableRow         |       ✅       |      ✅       |     dep     |                 |      |              |
| text             |       ✅       |      ✅       |     dep     |                 |      |              |

## Special nodes that will exist only for migration process and will be removed after that
| Name                     | Schema setup | Migration valid | Removed after gold |
|--------------------------|:------------:|:---------------:|:------------------:|
| embedExternalImage       |      ✅       |                 |                    |
| embedExternalImageInline |      ✅       |                 |                    |

## Extensions
| Name                | Feature clear | Development | Migration valid | Docs | Feature done |
|---------------------|:-------------:|:-----------:|:---------------:|------|:------------:|
| anchor              |       ✅       |      ✅      |                 |      |              |
| collaboration       |       ✅       |     dep     |                 |      |              |
| collaborationCursor |       ✅       |     dep     |                 |      |              |
| dropCursor          |       ✅       |     dep     |                 |      |              |
| gapCursor           |       ✅       |     dep     |                 |      |              |
| listKeymap          |       ✅       |     dep     |                 |      |              |
| history             |       ✅       |     dep     |                 |      |              |
| textAlign           |       ✅       |     dep     |                 |      |              |
| tocGenerate         |       ✅       |      ✅      |                 |      |              |

## Supported media embed variants (needs to add all options)
| Name              | Feature clear | Development | Migration valid | Docs | Feature done |
|-------------------|:-------------:|:-----------:|:---------------:|------|:------------:|
| youtube           |               |             |                 |      |              |
