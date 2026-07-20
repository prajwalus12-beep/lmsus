import crypto from 'crypto'
import { cookies } from 'next/headers'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 10000

// Get secret key from env, or use fallback for dev
const SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-at-least-32-chars-long'

function getDerivedKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(SECRET, salt, ITERATIONS, KEY_LENGTH, 'sha256')
}

export function encryptSession(data: any): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = getDerivedKey(salt)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()
  
  // Combine all parts into a single base64 string
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

export function decryptSession(token: string): any | null {
  try {
    const buffer = Buffer.from(token, 'base64')
    
    const salt = buffer.subarray(0, SALT_LENGTH)
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + 16)
    
    const key = getDerivedKey(salt)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    
    return JSON.parse(decrypted.toString('utf8'))
  } catch (err) {
    console.error('Failed to decrypt session cookie:', err)
    return null
  }
}

export async function setSessionCookie(sessionData: any) {
  const token = encryptSession(sessionData)
  const cookieStore = await cookies()
  cookieStore.set('lms-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set('lms-session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0
  })
}

export async function getSessionFromCookie(): Promise<any | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('lms-session')?.value
  if (!token) return null
  return decryptSession(token)
}
