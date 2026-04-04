'use client'
import { useState, useEffect, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, getDocs } from 'firebase/firestore'
import { formatDistanceToNow } from 'date-fns'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Circle, CircleMessage } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'

const COLORS = ['#E8FF47','#47FFB2','#7C4DFF','#FF6B6B','#00BCD4','#FF9800']

export default function CirclesPage() {
  const { user } = useAuth()
  const [circles, setCircles] = useState<Circle[]>([])
  const [selected, setSelected] = useState<Circle | null>(null)
  const [messages, setMessages] = useState<CircleMessage[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'circles'), orderBy('memberCount', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setCircles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Circle)))
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!selected) return
    const q = query(collection(db, 'circles', selected.id, 'messages'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, async snap => {
      const msgs: CircleMessage[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const profileSnap = await getDoc(doc(db, 'profiles', data.userId))
        msgs.push({ id: d.id, ...data, profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } as any : undefined } as CircleMessage)
      }
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return unsub
  }, [selected])

  const createCircle = async () => {
    if (!newName.trim() || !user) return
    try {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const ref = await addDoc(collection(db, 'circles'), {
        name: newName.trim(), description: newDesc.trim(), color,
        createdBy: user.uid, memberCount: 1, createdAt: Date.now(),
      })
      setCreating(false); setNewName(''); setNewDesc('')
      const snap = await getDoc(ref)
      setSelected({ id: snap.id, ...snap.data() } as Circle)
      toast('Circle created!')
    } catch {
      toast('Failed to create circle', 'error')
    }
  }

  const sendMsg = async () => {
    if (!msg.trim() || !selected || !user || sending) return
    setSending(true)
    const text = msg; setMsg('')
    try {
      await addDoc(collection(db, 'circles', selected.id, 'messages'), {
        userId: user.uid, content: text, createdAt: Date.now(),
      })
    } catch {
      setMsg(text)
      toast('Message failed to send', 'error')
    }
    setSending(false)
  }

  if (selected) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}>← Back to Circles</button>
      <div className="animate-fade-in" style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: selected.color }} />
          <span style={{ color: '#F0F0F0', fontWeight: 700, fontSize: 16 }}>{selected.name}</span>
        </div>
        {selected.description && <p style={{ color: '#888', fontSize: 13, fontFamily: 'Georgia,serif', margin: '4px 0 0' }}>{selected.description}</p>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        {messages.length === 0 && (
          <div className="animate-fade-in" style={{ textAlign: 'center', color: '#555', padding: '32px 20px', fontFamily: 'Georgia,serif', fontSize: 14 }}>
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className="animate-fade-in" style={{ display: 'flex', gap: 10, flexDirection: m.userId === user?.uid ? 'row-reverse' : 'row' }}>
            <Avatar username={m.profile?.username ?? 'user'} size={32} />
            <div>
              {m.userId !== user?.uid && <div style={{ color: '#888', fontSize: 11, fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>@{m.profile?.username}</div>}
              <div style={{ background: m.userId === user?.uid ? selected.color : '#1E1E1E', color: m.userId === user?.uid ? '#0D0D0D' : '#F0F0F0', borderRadius: 16, padding: '10px 14px', fontSize: 14, fontFamily: 'Georgia,serif', maxWidth: '75%' }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMsg()}
          placeholder="Say something..."
          style={{ flex: 1, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: '10px 16px', color: '#F0F0F0', fontSize: 14, outline: 'none', fontFamily: 'Georgia,serif' }} />
        <button onClick={sendMsg} disabled={sending || !msg.trim()} style={{ background: msg.trim() ? selected.color : '#2A2A2A', border: 'none', borderRadius: 20, padding: '10px 18px', color: '#0D0D0D', fontWeight: 700, cursor: msg.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>Send</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Circles</h2>
        <p style={{ color: '#888', fontSize: 14, fontFamily: 'Georgia,serif' }}>Intimate communities around what you care about.</p>
      </div>
      {circles.map((c, i) => (
        <div key={c.id} className="animate-fade-in-up" onClick={() => setSelected(c)}
          style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 14, padding: '16px 18px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.2s', animationDelay: `${i * 0.05}s` }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = c.color)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.color }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{c.name}</div>
            <div style={{ color: '#555', fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{c.memberCount} members</div>
          </div>
          <span style={{ color: '#555' }}>›</span>
        </div>
      ))}
      {creating ? (
        <div className="animate-fade-in-up" style={{ background: '#141414', border: '1px solid #3A3A3A', borderRadius: 14, padding: '16px 18px' }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Circle name"
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createCircle()}
            style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, padding: '10px 14px', color: '#F0F0F0', fontSize: 14, outline: 'none', marginBottom: 10 }} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, padding: '10px 14px', color: '#F0F0F0', fontSize: 14, outline: 'none', marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCreating(false)} style={{ flex: 1, background: 'none', border: '1px solid #2A2A2A', borderRadius: 20, padding: 9, color: '#888', cursor: 'pointer' }}>Cancel</button>
            <button onClick={createCircle} disabled={!newName.trim()} style={{ flex: 1, background: newName.trim() ? '#E8FF47' : '#2A2A2A', border: 'none', borderRadius: 20, padding: 9, color: newName.trim() ? '#0D0D0D' : '#555', fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>Create</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          style={{ width: '100%', background: 'none', border: '1px dashed #2A2A2A', borderRadius: 14, padding: 14, color: '#555', cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8FF47'; e.currentTarget.style.color = '#E8FF47' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#555' }}>
          + Create a Circle
        </button>
      )}
    </div>
  )
}
