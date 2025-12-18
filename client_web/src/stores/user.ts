import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types/user'

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null)

  const contacts = ref<User[]>([])

  function getUserById(userId: string): User | undefined {
    if (currentUser.value && userId === currentUser.value.id) {
      return currentUser.value
    }
    return contacts.value.find(c => c.id === userId)
  }

  function setCurrentUser(user: User) {
    currentUser.value = user
  }

  function loadContacts(users: User[]) {
    contacts.value = currentUser.value
      ? users.filter(u => u.id !== currentUser.value!.id)
      : users
  }

  return {
    currentUser,
    contacts,
    getUserById,
    setCurrentUser,
    loadContacts,
  }
})
