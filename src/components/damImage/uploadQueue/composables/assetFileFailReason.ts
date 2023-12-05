import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { AssetFileFailReason } from '@/types/coreDam/AssetFile'

export function useAssetFileFailReason() {
  const { t } = useI18n()

  const assetFileFailReasonOptions = ref<ValueObjectOption<AssetFileFailReason>[]>([
    {
      value: AssetFileFailReason.None,
      title: t('common.damImage.asset.assetFileFailReason.none'),
    },
    {
      value: AssetFileFailReason.Unknown,
      title: t('common.damImage.asset.assetFileFailReason.unknown'),
    },
    {
      value: AssetFileFailReason.InvalidChecksum,
      title: t('common.damImage.asset.assetFileFailReason.invalidChecksum'),
    },
    {
      value: AssetFileFailReason.InvalidMimeType,
      title: t('common.damImage.asset.assetFileFailReason.invalidMimeType'),
    },
    {
      value: AssetFileFailReason.DownloadFailed,
      title: t('common.damImage.asset.assetFileFailReason.downloadFailed'),
    },
    {
      value: AssetFileFailReason.InvalidSize,
      title: t('common.damImage.asset.assetFileFailReason.invalidSize'),
    },
  ])

  const getAssetFileFailReasonOption = (value: AssetFileFailReason) => {
    return assetFileFailReasonOptions.value.find((item) => item.value === value)
  }

  return {
    assetFileFailReasonOptions,
    getAssetFileFailReasonOption,
  }
}
