import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePermissionStore } from './permission'
import { normalizeIdentity } from '@/utils/loginIdentity'
import { clearDictionaryCache, dictionaryOwner } from '@/utils/dictionaryCache'

const initState = {
  token: '',
  userid: '',
  username: '',
  realname: '',
  welcome: '',
  avatar: '',
  tenantId: 0,
  phone: '',
  email: '',
  sex: 1,
  birthday:'',
  loginTenantId:0,
  // 本地存储时间
  localStorageTime: 0,
  // 组织编码名称
  orgCodeTxt: '',
}

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<IUserInfo>({ ...initState })
    const setUserInfo = (val: IUserInfo) => {
      if(val?.loginTenantId){
        val.tenantId = val.loginTenantId;
      }
      if (dictionaryOwner(userInfo.value) !== dictionaryOwner(val)) clearDictionaryCache()
      userInfo.value = val
    }
    const clearUserInfo = () => {
      clearDictionaryCache()
      userInfo.value = { ...initState }
      usePermissionStore().reset()
    }
    const getUserInfo = () => {
      return userInfo.value
    }
    const editUserInfo = (options) => {
      if (dictionaryOwner(userInfo.value) !== dictionaryOwner({ ...userInfo.value, ...options })) clearDictionaryCache()
      userInfo.value = { ...userInfo.value, ...options }
    }
    const setTenant = (tenantId) => {
      if (userInfo.value.tenantId !== tenantId) clearDictionaryCache()
      userInfo.value.tenantId = tenantId;
    }
    const getTenant = () => {
      return userInfo.value.tenantId;
    }
    // 一般没有reset需求，不需要的可以删除
    const reset = () => {
      clearDictionaryCache()
      userInfo.value = { ...initState }
      usePermissionStore().reset()
    }
    const isLogined = computed(() => !!userInfo.value.token)
    const identity = computed(() => normalizeIdentity(userInfo.value))
    return {
      identity,
      userInfo,
      setUserInfo,
      getUserInfo,
      clearUserInfo,
      setTenant,
      getTenant,
      isLogined,
      editUserInfo,
      reset,
    }
  },
  {
    // 如果需要持久化就写 true, 不需要持久化就写 false（或者去掉这个配置项）
    persist: true,
  },
)
