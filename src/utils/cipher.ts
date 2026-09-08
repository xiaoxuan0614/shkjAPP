import CryptoJS from 'crypto-js'

const AES_KEY = CryptoJS.enc.Utf8.parse('1234567890adbcde')
const AES_IV = CryptoJS.enc.Utf8.parse('1234567890hjlkew')

/** 与 SHKJ-OA、后端登录解密保持一致的 AES-CBC/PKCS7 加密。 */
export const encryptLoginPassword = (plainText: string) =>
  CryptoJS.AES.encrypt(plainText, AES_KEY, {
    iv: AES_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString()
