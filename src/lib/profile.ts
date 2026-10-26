import { db } from './db'

export interface UserProfile {
  name: string
  account: string
}

export async function getUserProfile(): Promise<UserProfile> {
  const { data, error } = await db.auth.getUser()
  if (error) throw error
  const metadata = data.user?.user_metadata ?? {}
  return {
    name: String(metadata.display_name ?? metadata.full_name ?? ''),
    account: String(metadata.bank_account ?? ''),
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const { error } = await db.auth.updateUser({
    data: {
      display_name: profile.name.trim(),
      bank_account: profile.account.trim(),
    },
  })
  if (error) throw error
}


