'use client'
import { useState, useEffect, useRef } from 'react'
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, getDocs, setDoc, or } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Conversation, DirectMessage, Profile } from '@/types'
import Avatar from '@/components/ui/Avatar'

export default function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<{ conv: Conversation; otherUser: Profile } | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [input, setInput] = useState('')
  const [following, setFollowing] = useState<Profile[]>([])
  const [composing, setComposing] = useState(false)
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    // Load conversations where user is a participant
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'))
    const unsub = onSnapshot(q, async snap => {
      const convs: Conversation[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const otherId = data.participants.find((p: string) => p !== user.uid)
        const profileSnap = await getDoc(doc(db, 'profiles', otherId))
        convs.push({ id: d.id, ...data, otherUser: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as Profile : undefined } as any as Conversation)
      }
      setConversations(convs)
    })

    // Load following for new conversation
    const loadFollowing = async () => {
      const snap = await getDocs(collection(db, 'profiles', user.uid, 'following'))
      const profiles: Profile[] = []
      for (const d of snap.docs) {
        const profileSnap = await getDoc(doc(db, 'profiles', d.id))
        if (profileSnap.exists()) profiles.push({ id: profileSnap.id, ...profileSnap.data() } as Profile)
      }
      setFollowing(profiles)
    }
    loadFollowing()
    return unsub
  }, [user])

  useEffect(() => {
    if (!selected) return
    const q = query(collection(db, 'conversations', selected.conv.id, 'messages'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage)))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 50)
    })
    return unsub
  }, [selected])

  const startConversation = async (otherUser: Profile) => {
    if (!user) return
    // Check if conversation exists
    const existing = conversations.find(c => c.participants?.includes(otherUser.id))
    if (existing) { setSelected({ conv: existing, otherUser }); setComposing(false); return }
    const ref = await addDoc(collection(db, 'conversations'), {
      participants: [user.uid, otherUser.id],
      lastMessage: '', lastMessageAt: Date.now(), createdAt: Date.now(),
    })
    const snap = await getDoc(ref)
    setSelected({ conv: { id: snap.id, ...snap.data() } as Conversation, otherUser })
    setComposing(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || !selected || !user) return
    const text = input; setInput('')
    await addDoc(collection(db, 'conversations', selected.conv.id, 'messages'), {
      senderId: user.uid, content: text, readAt: null, createdAt: Date.now(),
    })
    await setDoc(doc(db, 'conversations', selected.conv.id), {
      lastMessage: text,
      lastMessageAt: Date.now(),
      lastSenderId: user.uid,
    }, { merge: true })
  }

  const filteredFollowing = following.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.displayName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (selected) return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px', display:'flex', flexDirection:'column', height:'calc(100vh - 130px)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:16, borderBottom:'1px solid #2A2A2A', flexShrink:0 }}>
        <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:18, padding:0 }}>←</button>
        <Avatar username={selected.otherUser.username} size={36} />
        <div>
          <div style={{ color:'#F0F0F0', fontWeight:700, fontSize:14 }}>{selected.otherUser.displayName ?? selected.otherUser.username}</div>
          <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{selected.otherUser.username}</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'16px 0' }}>
        {messages.map(m => {
          const isMe = m.senderId === user?.uid
          return (
            <div key={m.id} style={{ display:'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems:'flex-end', gap:8 }}>
              <div>
                <div style={{ background: isMe ? '#E8FF47' : '#1E1E1E', color: isMe ? '#0D0D0D' : '#F0F0F0', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding:'10px 14px', fontSize:14, fontFamily:'Georgia,serif', lineHeight:1.55, maxWidth:'72vw' }}>
                  {m.content}
                </div>
                <div style={{ color:'#555', fontSize:10, marginTop:3, textAlign: isMe ? 'right' : 'left', fontFamily:"'DM Mono',monospace" }}>
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix:true })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display:'flex', gap:8, paddingTop:12, borderTop:'1px solid #2A2A2A', flexShrink:0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={`Message @${selected.otherUser.username}...`} maxLength={1000} rows={1}
          style={{ flex:1, background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:20, padding:'10px 16px', color:'#F0F0F0', fontSize:14, outline:'none', resize:'none', fontFamily:'Georgia,serif', maxHeight:100 }} />
        <button onClick={sendMessage} disabled={!input.trim()} style={{ background: input.trim() ? '#E8FF47' : '#2A2A2A', border:'none', borderRadius:20, padding:'10px 18px', color: input.trim() ? '#0D0D0D' : '#555', fontWeight:700, fontSize:13, cursor: input.trim() ? 'pointer' : 'default', flexShrink:0, transition:'all 0.15s' }}>↑</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ color:'#F0F0F0', fontSize:20, fontWeight:700, marginBottom:2 }}>Messages</h2>
          <p style={{ color:'#888', fontSize:13, fontFamily:'Georgia,serif' }}>Private conversations.</p>
        </div>
        <button onClick={() => setComposing(!composing)} style={{ background: composing ? '#2A2A2A' : '#E8FF47', border:'none', borderRadius:20, padding:'8px 16px', color: composing ? '#888' : '#0D0D0D', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {composing ? 'Cancel' : '+ New'}
        </button>
      </div>

      {composing && (
        <div style={{ background:'#141414', border:'1px solid #3A3A3A', borderRadius:14, padding:16, marginBottom:16 }}>
          <p style={{ color:'#888', fontSize:12, marginBottom:10, fontFamily:"'DM Mono',monospace" }}>MESSAGE SOMEONE YOU FOLLOW</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username..." autoFocus
            style={{ width:'100%', background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:10, padding:'10px 14px', color:'#F0F0F0', fontSize:14, outline:'none', marginBottom:10 }} />
          {search && filteredFollowing.slice(0, 5).map(p => (
            <button key={p.id} onClick={() => startConversation(p)}
              style={{ width:'100%', background:'none', border:'1px solid #2A2A2A', borderRadius:10, padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, marginBottom:6, textAlign:'left' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='#E8FF47'}
              onMouseLeave={e => e.currentTarget.style.borderColor='#2A2A2A'}>
              <Avatar username={p.username} size={32} />
              <div>
                <div style={{ color:'#F0F0F0', fontSize:13, fontWeight:600 }}>{p.displayName ?? p.username}</div>
                <div style={{ color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace" }}>@{p.username}</div>
              </div>
            </button>
          ))}
          {search && filteredFollowing.length === 0 && <p style={{ color:'#555', fontSize:13, padding:10 }}>No one found. You can only message people you follow.</p>}
        </div>
      )}

      {conversations.length === 0 ? (
        <div style={{ textAlign:'center', color:'#555', padding:'60px 20px' }}>
          <p style={{ fontSize:28, marginBottom:12 }}>✉</p>
          <p style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#888', marginBottom:6 }}>No messages yet.</p>
          <p style={{ fontSize:13 }}>Follow someone and start a conversation.</p>
        </div>
      ) : conversations.map(conv => {
        const other = conv.otherUser
        if (!other) return null
        return (
          <div key={conv.id} onClick={() => setSelected({ conv, otherUser: other })}
            style={{ background:'#141414', border:'1px solid #2A2A2A', borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#3A3A3A'}
            onMouseLeave={e => e.currentTarget.style.borderColor='#2A2A2A'}>
            <Avatar username={other.username} size={44} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ color:'#F0F0F0', fontWeight:600, fontSize:14 }}>{other.displayName ?? other.username}</span>
                <span style={{ color:'#555', fontSize:11 }}>{conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix:true }) : ''}</span>
              </div>
              <div style={{ color:'#555', fontSize:13, fontFamily:'Georgia,serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{conv.lastMessage || 'No messages yet'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
