import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteParams,
} from 'vue-router'
import HomepageView from '@/playground/HomepageView.vue'
import SettingsView from '@/playground/SettingsView.vue'
import BooleanValueView from '@/playground/booleanValueView/BooleanValueView.vue'
import PermissionView from '@/playground/permissionView/PermissionView.vue'
import DatetimeView from '@/playground/datetimeView/DatetimeView.vue'
import FormsView from '@/playground/formsView/FormsView.vue'
import FilterView from '@/playground/filterView/FilterView.vue'
import TableView from '@/playground/tableView/TableView.vue'
import BtnSplitView from '@/playground/btnSplitView/BtnSplitView.vue'
import AssetSelectView from '@/playground/assetSelectView/AssetSelectView.vue'
import ApiFetchListBatchView from '@/playground/apiFetchListBatchView/ApiFetchListBatchView.vue'
import ImageView from '@/playground/imageView/ImageView.vue'
import FileView from '@/playground/fileView/FileView.vue'
import SortableView from '@/playground/sortableView/SortableView.vue'
import { initLanguageMessagesLoaded, initLoadLanguageMessages } from '@/playground/system/loadLanguageMessages'
import AlertView from '@/playground/alertView/AlertView.vue'
import SubjectSelectView from '@/playground/subjectSelectView/SubjectSelectView.vue'
import ImageMultipleView from '@/playground/imageMultipleView/ImageMultipleView.vue'
import CollabDetailView from '@/playground/collabView/CollabDetailView.vue'
import CollabEditView from '@/playground/collabView/CollabEditView.vue'
import { useCollabHelpers } from '@/components/collab/composables/collabHelpers'
import { CollabAccessRoomStatus, CollabRoomJoinStrategy } from '@/components/collab/types/Collab'
import { ref } from 'vue'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'
import { useCollabInit } from '@/components/collab/composables/collabInit'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useAlerts } from '@/composables/system/alerts'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import { updateCurrentUser, useCurrentUser } from '@/playground/collabView/currentUser'
import CopyTextView from '@/playground/copyTextView/CopyTextView.vue'
import ImagePublicInputView from '@/playground/imagePublicInputView/ImagePublicInputView.vue'
import RemoteAutocompleteView from '@/playground/remoteAutocompleteView/RemoteAutocompleteView.vue'
import SubjectListView from '@/playground/filterV2View/SubjectListView.vue'

const { createCollabRoom } = useCollabHelpers()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomepageView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/view/boolean-value',
      name: 'view-boolean-value',
      component: BooleanValueView,
    },
    {
      path: '/view/copy-text',
      name: 'view-copy-text',
      component: CopyTextView,
    },
    {
      path: '/view/permission',
      name: 'view-permission',
      component: PermissionView,
    },
    {
      path: '/view/datetime',
      name: 'view-datetime',
      component: DatetimeView,
    },
    {
      path: '/view/forms',
      name: 'view-forms',
      component: FormsView,
    },
    {
      path: '/view/remote-autocomplete',
      name: 'view-remote-autocomplete',
      component: RemoteAutocompleteView,
    },
    {
      path: '/view/filters',
      name: 'view-filters',
      component: FilterView,
    },
    {
      path: '/view/filters2',
      name: 'view-filters2',
      component: SubjectListView,
    },
    {
      path: '/view/table',
      name: 'view-table',
      component: TableView,
    },
    {
      path: '/view/split-buttons',
      name: 'view-split-buttons',
      component: BtnSplitView,
    },
    {
      path: '/view/subject-select',
      name: 'view-subject-select',
      component: SubjectSelectView,
    },
    {
      path: '/view/asset-select',
      name: 'view-asset-select',
      component: AssetSelectView,
    },
    {
      path: '/view/image',
      name: 'view-image',
      component: ImageView,
    },
    {
      path: '/view/image-multiple',
      name: 'view-image-multiple',
      component: ImageMultipleView,
    },
    {
      path: '/view/image-public-input',
      name: 'view-image-public-input',
      component: ImagePublicInputView,
    },
    {
      path: '/view/file',
      name: 'view-file',
      component: FileView,
    },
    {
      path: '/view/sortable',
      name: 'view-sortable',
      component: SortableView,
    },
    {
      path: '/view/alert',
      name: 'view-alert',
      component: AlertView,
    },
    {
      path: '/view/fetch-batch',
      name: 'view-fetch-batch',
      component: ApiFetchListBatchView,
    },
    {
      path: '/view/collab-detail',
      name: 'view-collab-detail',
      component: CollabDetailView,
    },
    {
      path: '/view/collab-edit',
      name: 'view-collab-edit',
      component: CollabEditView,
      meta: {
        collab: () => ({
          room: createCollabRoom(1, 'playground', 'cms'),
          joinStrategy: CollabRoomJoinStrategy.Moderated,
          occupiedOrKickedRedirectToRoute: 'view-collab-detail',
          editors: ['testEditor'],
        }),
      },
    },
  ],
})

const initialized = ref(false)
const { collabOptions } = useCommonAdminCollabOptions()

const checkCollab = async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const { showWarningT, showErrorT } = useAlerts()

  if (!collabOptions.value.enabled) return next()

  if (from.meta.collab) {
    // @ts-ignore
    const { leaveCollabRoom } = useCollabRoom(from.meta.collab(from.params).room)
    leaveCollabRoom()
  }

  if (to.meta.collab) {
    // @ts-ignore
    const collab = to.meta.collab(to.params)
    const { joinCollabRoom, alertedOccupiedRooms } = useCollabRoom(collab.room)

    try {
      await joinCollabRoom({ joinStrategy: collab.joinStrategy, editors: collab.editors })
    } catch (error) {
      if (error instanceof Error && error.message === CollabAccessRoomStatus.Failed) {
        showErrorT('common.collab.alert.error')
        return next(from)
      }
      showWarningT('common.collab.alert.occupied')
      alertedOccupiedRooms.value.add(collab.room)

      const redirectToRoute = collab.occupiedOrKickedRedirectToRoute
      const params: RouteParams = {}
      if (to.params && to.params.id) {
        params.id = to.params.id
      }

      return next({ name: redirectToRoute, params })
    }
  }

  next()
}

router.beforeEach(async (to, from, next) => {
  if (!initLanguageMessagesLoaded.value) await initLoadLanguageMessages()
  if (!initialized.value) {
    const { currentUser } = useCurrentUser()
    await updateCurrentUser()
    // init what needed
    const { setCollabUserCurrentId } = useCollabCurrentUserId()
    setCollabUserCurrentId(currentUser.value?.id ?? null)
    const { initCollab } = useCollabInit()
    initCollab()
    initialized.value = true
  }
  await checkCollab(to, from, next)
})

export default router
