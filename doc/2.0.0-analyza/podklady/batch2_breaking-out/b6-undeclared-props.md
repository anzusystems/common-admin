# B6: props admins pass that the library component does not declare (fall through $attrs to the root)

Generated from b6-prop-usage.json (template AST). readonly works only because the root is the Vuetify field; v and loading are silently ignored.

## `loading` (2 sites)

### AFormValueObjectOptionsSelect (2)
- cms:src/domains/dam/components/VoiceFamilySelect.vue:74
- cms:src/domains/cms/trendingArticleGroupList/components/TrendingArticleGroupSelect.vue:54

## `v` (13 sites)

### AFormSwitch (6)
- cms:src/domains/ai/model/components/ModelManage.vue:44
- cms:src/domains/ai/promptTemplate/components/PromptTemplateManage.vue:86
- cms:src/domains/ai/promptTemplateCategory/components/PromptTemplateCategoryManage.vue:68
- cms:src/domains/cms/articleIntention/components/ArticleIntentionManage.vue:43
- cms:src/domains/cms/articleIntention/components/ArticleIntentionManage.vue:56
- cms:src/domains/cms/newsletterPromo/components/NewsletterPromoManage.vue:142

### DamAssetLicenceRemoteAutocomplete (2)
- cms:src/domains/cms/siteGroup/components/SiteGroupManage.vue:283
- dam:src/domains/coreDam/ttsNarrationRequest/components/TtsNarrationRequestSynthesizeButton.vue:137

### DamExtSystemRemoteAutocomplete (5)
- dam:src/domains/coreDam/assetLicence/components/AssetLicenceEditForm.vue:57
- dam:src/domains/coreDam/assetLicenceGroup/components/AssetLicenceGroupCreateButton.vue:87
- dam:src/domains/coreDam/assetLicenceGroup/components/AssetLicenceGroupEditForm.vue:47
- dam:src/domains/coreDam/ttsNarrationRequest/components/TtsNarrationRequestSynthesizeButton.vue:118
- dam:src/domains/coreDam/voiceFamily/components/VoiceFamilyCreateButton.vue:83

## `hideDetails` (57 sites)

### AFormSwitch (54)
- cms:src/domains/cms/aiModel/components/AiModelCreate.vue:104
- cms:src/domains/cms/aiModel/components/AiModelEdit.vue:102
- cms:src/domains/cms/articleIntention/components/ArticleIntentionRecommenderFields.vue:25
- cms:src/domains/cms/keyword/components/KeywordCreate.vue:56
- cms:src/domains/cms/keyword/components/KeywordCreate.vue:84
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:68
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:76
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:84
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:92
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:99
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:127
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:147
- cms:src/domains/cms/liveBlogFeed/components/LiveBlogFeedManage.vue:188
- cms:src/domains/cms/liveBlogFeed/components/LiveBlogFeedManage.vue:195
- cms:src/domains/cms/liveBlogFeed/components/LiveBlogFeedManagementForm.vue:127
- cms:src/domains/cms/mcpServer/components/McpServerEdit.vue:59
- cms:src/domains/cms/minuteFeed/components/MinuteFeedManage.vue:109
- cms:src/domains/cms/prompt/components/PromptCreate.vue:68
- cms:src/domains/cms/prompt/components/PromptCreate.vue:81
- cms:src/domains/cms/prompt/components/PromptEdit.vue:91
- cms:src/domains/cms/prompt/components/PromptEdit.vue:98
- cms:src/domains/cms/rubric/components/RubricManage.vue:279
- cms:src/domains/cms/scenario/components/ScenarioItemForm.vue:150
- cms:src/domains/cms/scenario/components/ScenarioItemForm.vue:307
- cms:src/domains/cms/site/components/SiteManage.vue:385
- cms:src/domains/cms/site/components/SiteManage.vue:392
- cms:src/domains/cms/site/components/SiteManage.vue:399
- cms:src/domains/cms/site/components/SiteManage.vue:406
- cms:src/domains/cms/site/components/SiteManage.vue:413
- cms:src/domains/cms/site/components/SiteManage.vue:420
- cms:src/domains/cms/site/components/SiteManage.vue:427
- cms:src/domains/cms/site/components/SiteManage.vue:433
- cms:src/domains/cms/site/components/SiteManage.vue:494
- cms:src/domains/cms/site/components/SiteManage.vue:501
- cms:src/domains/cms/site/components/SiteManage.vue:508
- cms:src/domains/cms/site/components/SiteManage.vue:515
- cms:src/domains/cms/site/components/SiteManage.vue:522
- cms:src/domains/cms/site/components/SiteManage.vue:597
- cms:src/domains/cms/site/components/SiteManage.vue:804
- cms:src/domains/cms/site/components/SitePwaForm.vue:31
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemBaseAdvancedForm.vue:74
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindArticleListForm.vue:513
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindAugmentBoxForm.vue:416
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindAugmentBoxForm.vue:536
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBoxForm.vue:371
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBoxForm.vue:491
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:67
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:74
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:81
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:88
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepAuthorProperties.vue:95
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:166
- cms:src/domains/cms/article/components/widgets/variant/ArticleWidgetRecommender.vue:59
- cms:src/domains/cms/article/components/widgets/variant/ArticleWidgetRecommender.vue:70

### AFormTextField (3)
- cms:src/domains/cms/gameGenre/components/GameGenreManageMatchTextKeys.vue:31
- cms:src/domains/cms/notification/components/NotificationManage.vue:142
- cms:src/domains/cms/shared/components/TakeoverBodyPatternsInput.vue:44

## `clearable` (30 sites)

### AFormTextField (24)
- cms:src/domains/cms/articleIntention/components/ArticleIntentionRecommenderFields.vue:34
- cms:src/domains/cms/articleIntention/components/ArticleIntentionRecommenderFields.vue:56
- cms:src/domains/cms/articleMilestone/components/ArticleMilestoneManage.vue:96
- cms:src/domains/cms/articleMilestone/components/ArticleMilestoneManage.vue:107
- cms:src/domains/cms/articleMilestone/components/ArticleMilestoneManage.vue:118
- cms:src/domains/cms/contentHubAutomat/components/ContentHubAutomatManage.vue:203
- cms:src/domains/cms/contentHubAutomat/components/ContentHubAutomatManage.vue:213
- cms:src/domains/cms/contentHubAutomat/components/ContentHubAutomatManage.vue:248
- cms:src/domains/cms/keyword/components/KeywordCreate.vue:69
- cms:src/domains/cms/keyword/components/KeywordEdit.vue:112
- cms:src/domains/cms/trendingArticle/components/TrendingArticleGroupForm.vue:99
- cms:src/domains/cms/trendingArticle/components/TrendingArticleGroupForm.vue:118
- forum:src/domains/forum/extSystem/components/ExtSystemManage.vue:226
- forum:src/domains/forum/job/components/JobManage.vue:144
- forum:src/domains/forum/job/components/JobManage.vue:166
- forum:src/domains/forum/job/components/JobManage.vue:205
- forum:src/domains/forum/job/components/JobManage.vue:226
- forum:src/domains/forum/job/components/JobManage.vue:256
- forum:src/domains/forum/prompt/components/PromptManage.vue:126
- forum:src/domains/forum/prompt/components/PromptManage.vue:182
- forum:src/domains/forum/prompt/components/PromptManage.vue:194
- forum:src/domains/forum/prompt/components/PromptManage.vue:207
- forum:src/domains/forum/prompt/components/PromptManage.vue:219
- forum:src/domains/forum/prompt/components/PromptManage.vue:247

### DamExternalProviderAssetSelect (3)
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:311
- dam:src/domains/coreDam/user/components/DamUserFields.vue:85
- dam:src/domains/coreDam/user/components/UserEditForm.vue:99

### DamDistributionServiceSelect (3)
- cms:src/domains/cms/wizard/components/userAuthorWizard/UserAuthorWizardStepUserCreate.vue:320
- dam:src/domains/coreDam/user/components/DamUserFields.vue:96
- dam:src/domains/coreDam/user/components/UserEditForm.vue:109

## `readonly` (265 sites)

### AFormTextField (166)
- per admin: {"cms":155,"dam":11} (full list in b6-prop-usage.json key AFormTextField.readonly)

### AFormTextarea (57)
- per admin: {"cms":57} (full list in b6-prop-usage.json key AFormTextarea.readonly)

### AFormSwitch (8)
- cms:src/domains/cms/site/components/SitePwaForm.vue:30
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemBaseAdvancedForm.vue:73
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindArticleListForm.vue:512
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindAugmentBoxForm.vue:415
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindAugmentBoxForm.vue:534
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBoxForm.vue:370
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBoxForm.vue:489
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindTrendingArticleListForm.vue:79

### AFormDatetimePicker (23)
- per admin: {"cms":23} (full list in b6-prop-usage.json key AFormDatetimePicker.readonly)

### ABooleanSelect (1)
- cms:src/domains/cms/trendingArticle/components/TrendingArticleGroupForm.vue:180

### ADatetimePicker (4)
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBreakingNewsForm.vue:80
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindBreakingNewsForm.vue:87
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindImportantNewsForm.vue:87
- cms:src/domains/cms/contentItemKind/components/forms/ContentItemKindImportantNewsForm.vue:94

### DamAssetLicenceGroupRemoteAutocomplete (1)
- dam:src/domains/coreDam/user/components/DamUserFields.vue:39

### DamAssetLicenceRemoteAutocomplete (1)
- dam:src/domains/coreDam/user/components/DamUserFields.vue:50

### DamExtSystemRemoteAutocomplete (2)
- dam:src/domains/coreDam/user/components/DamUserFields.vue:61
- dam:src/domains/coreDam/user/components/DamUserFields.vue:72

### DamExternalProviderAssetSelect (1)
- dam:src/domains/coreDam/user/components/DamUserFields.vue:83

### DamDistributionServiceSelect (1)
- dam:src/domains/coreDam/user/components/DamUserFields.vue:94

## `density` (4 sites)

### AFormTextField (4)
- cms:src/domains/cms/promptVersion/components/PromptVersionManage.vue:127
- cms:src/domains/cms/promptVersion/components/PromptVersionManage.vue:135
- cms:src/domains/cms/promptVersion/components/PromptVersionManage.vue:144
- cms:src/domains/cms/promptVersion/components/PromptVersionManage.vue:153

## `disabled` (1 sites)

### DamAssetLicenceRemoteAutocomplete (1)
- dam:src/domains/coreDam/ttsNarrationRequest/components/TtsNarrationRequestSynthesizeButton.vue:138
