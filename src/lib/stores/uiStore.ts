import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ModalType = 'createRoom' | 'inviteUser' | 'browseRooms' | null

interface UIStore {
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  activeRoomId: string | null
  setActiveRoom: (roomId: string | null) => void

  modal: ModalType
  setModal: (modal: ModalType) => void

  /** Mobile: which screen is showing — 'rooms' (sidebar) or 'chat'. */
  mobileScreen: 'rooms' | 'chat'
  setMobileScreen: (screen: 'rooms' | 'chat') => void

  /** Mobile drawer: slide-in sidebar overlay. */
  isDrawerOpen: boolean
  setDrawerOpen: (open: boolean) => void

  /** Desktop right panel: member list. */
  isMemberPanelOpen: boolean
  setMemberPanelOpen: (open: boolean) => void

  /** Message search panel */
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void

  /** ID of message to scroll-to and highlight after search result click. */
  highlightedMessageId: string | null
  setHighlightedMessageId: (id: string | null) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      activeRoomId: null,
      setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

      modal: null,
      setModal: (modal) => set({ modal }),

      mobileScreen: 'rooms',
      setMobileScreen: (screen) => set({ mobileScreen: screen }),

      isDrawerOpen: false,
      setDrawerOpen: (open) => set({ isDrawerOpen: open }),

      isMemberPanelOpen: false,
      setMemberPanelOpen: (open) => set({ isMemberPanelOpen: open }),

      isSearchOpen: false,
      setSearchOpen: (open) => set({ isSearchOpen: open, ...(!open && { highlightedMessageId: null }) }),

      highlightedMessageId: null,
      setHighlightedMessageId: (id) => set({ highlightedMessageId: id }),
    }),
    {
      name: 'quorum-ui',
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        isMemberPanelOpen: state.isMemberPanelOpen,
      }),
    }
  )
)
