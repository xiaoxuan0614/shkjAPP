<template>
  <!-- #ifdef H5 -->
  <wd-popup
    v-model="visible"
    position="bottom"
    :root-portal="true"
    :z-index="2200"
    :safe-area-inset-bottom="true"
    custom-style="border-radius:16px 16px 0 0;"
  >
    <view class="file-preview">
      <view class="file-preview__head">
        <view class="file-preview__heading">
          <text class="file-preview__title">文件预览</text>
          <text class="file-preview__name">{{ selected?.name }}</text>
        </view>
        <button class="file-preview__close" aria-label="关闭文件预览" @click="visible = false">
          <wd-icon name="close" size="18px" />
        </button>
      </view>
      <FilePreviewContent v-if="visible && selected" :file="selected" />
    </view>
  </wd-popup>
  <!-- #endif -->
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { contractFileRequest, fileExtension, type ContractFile } from '@/utils/contractFile'

// #ifdef H5
const FilePreviewContent = defineAsyncComponent(() => import('./FilePreviewContent.vue'))
// #endif
const visible = ref(false)
const selected = ref<ContractFile>()
let opening = false
const open = async (file: ContractFile) => {
  if (opening) return
  // #ifdef H5
  selected.value = file
  visible.value = true
  // #endif
  // #ifndef H5
  opening = true
  uni.showLoading({ title: '正在读取文件', mask: true })
  try {
    const { url, header } = contractFileRequest(file.path)
    const extension = fileExtension(file)
    const response = await uni.downloadFile({ url, header, timeout: 30000 })
    if (response.statusCode !== 200) throw new Error('文件读取失败，请检查附件后重试')
    uni.hideLoading()
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(extension)) {
      await uni.previewImage({ urls: [response.tempFilePath] })
    } else {
      await uni.openDocument({
        filePath: response.tempFilePath,
        fileType: extension as 'pdf',
        showMenu: true,
      })
    }
  } catch (error: any) {
    uni.showToast({ icon: 'none', title: error?.message || '无法预览此文件，请检查格式或稍后重试' })
  } finally {
    uni.hideLoading()
    opening = false
  }
  // #endif
}
defineExpose({ open })
</script>

<style scoped lang="scss">
.file-preview {
  display: flex;
  flex-direction: column;
  height: 90vh;
  max-height: calc(100vh - 24px - env(safe-area-inset-bottom));
  background: #fff;
}
.file-preview__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #edf0f3;
}
.file-preview__heading {
  flex: 1;
  min-width: 0;
}
.file-preview__title,
.file-preview__name {
  display: block;
  color: #27364a;
  line-height: 1.5;
}
.file-preview__title {
  font-size: 18px;
  font-weight: 600;
}
.file-preview__name {
  color: #68788a;
  font-size: 14px;
  overflow-wrap: anywhere;
  max-height: 63px;
  overflow-y: auto;
}
.file-preview__close {
  display: flex;
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  margin: 0;
  align-items: center;
  justify-content: center;
  color: #596574;
  background: transparent;
}
.file-preview__close::after {
  border: none;
}
</style>
