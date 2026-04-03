import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import {
  doc, setDoc, addDoc, updateDoc, collection, getDocs, getDoc,
  query, where, limit, increment, writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

const DEMO_CREDS = { email: 'demo1@yawp.com', password: 'DemoYawp2024!' }

const DEMO_PROFILES = [
  {
    email: 'demo1@yawp.com', password: 'DemoYawp2024!',
    username: 'alex_rivera', displayName: 'Alex Rivera',
    bio: 'Recovering algorithmic optimist. Writing to think, not to perform.',
  },
  {
    email: 'demo2@yawp.com', password: 'DemoYawp2024!',
    username: 'jordan_chen', displayName: 'Jordan Chen',
    bio: 'Poet. Morning pages devotee. Suspicious of recommendation engines.',
  },
  {
    email: 'demo3@yawp.com', password: 'DemoYawp2024!',
    username: 'taylor_morgan', displayName: 'Taylor Morgan',
    bio: 'Six months off Instagram. Turns out I have thoughts of my own.',
  },
]

function daysAgo(n: number) {
  return Date.now() - n * 86_400_000 - Math.floor(Math.random() * 3_600_000)
}

const SEED_POSTS = [
  { u: 0, content: "Three months without Twitter. My attention span is back. Turns out the problem wasn't me — it was the machine.", tags: ['#digitalwellness', '#slowinternet'], hearts: 14, ago: 2 },
  { u: 0, content: "Read a whole book today. Didn't post about it until now.", tags: ['#reading'], hearts: 8, ago: 3 },
  { u: 0, content: "The algorithm wanted me angry. I wanted to think. We couldn't find common ground.", tags: ['#noalgorithm'], hearts: 22, ago: 5 },
  { u: 0, content: "Chronic scrollers are not lazy. They're people whose attention was stolen by something specifically engineered to steal it.", tags: [], hearts: 31, ago: 8 },
  { u: 0, content: "Yawp theory: the best conversations happen when nobody's tracking how many people are watching.", tags: [], hearts: 17, ago: 12 },
  { u: 0, content: "Wrote something just for me today. Didn't publish it. Felt radical.", tags: ['#writing'], hearts: 9, ago: 18 },
  { u: 1, content: "Hot take: a social network that shows posts in the order they were written is a radical act.", tags: ['#chronological'], hearts: 27, ago: 1 },
  { u: 1, content: "I've been writing morning pages for 30 days. The voice in my head got quieter. The one on the page got louder.", tags: ['#writing', '#morningpages'], hearts: 19, ago: 4 },
  { u: 1, content: "Miss when the internet felt like discovery instead of delivery.", tags: ['#smallweb'], hearts: 33, ago: 6 },
  { u: 1, content: "Follower counts are just leaderboards for a game nobody agreed to play.", tags: [], hearts: 41, ago: 9 },
  { u: 1, content: "There's a specific kind of loneliness that comes from being seen by millions and known by none.", tags: [], hearts: 52, ago: 14 },
  { u: 1, content: "Some days I want to say something. Some days I want to listen. Today: just here.", tags: [], hearts: 7, ago: 20 },
  { u: 2, content: "Logged off Instagram 6 months ago. Nobody noticed except me — and I noticed I felt better.", tags: ['#digitaldetox'], hearts: 38, ago: 2 },
  { u: 2, content: "The best thing about Yawp is that I genuinely don't know if anyone will read this. Somehow that makes me write more honestly.", tags: [], hearts: 24, ago: 5 },
  { u: 2, content: "Less reach, more resonance.", tags: [], hearts: 18, ago: 7 },
  { u: 2, content: "Slow internet is a philosophy, not a limitation.", tags: ['#slowinternet'], hearts: 29, ago: 10 },
  { u: 2, content: "Turns out what I wanted wasn't an audience. I wanted a conversation.", tags: [], hearts: 45, ago: 15 },
  { u: 2, content: "Tried to explain Yawp to a friend. They asked 'but how do you grow?' I said 'that's kind of the point.'", tags: [], hearts: 36, ago: 22 },
]

const SEED_CIRCLES = [
  {
    name: 'Slow Readers',
    description: 'For people who read deliberately and without rushing.',
    color: '#47FFB2', createdBy: 0,
    messages: [
      { u: 0, content: "Currently 60 pages into Ursula K. Le Guin's The Dispossessed. Reading one chapter a day. Highly recommend this pace." },
      { u: 1, content: "I did that with Middlemarch last year. One chapter over coffee each morning. Finished it feeling genuinely changed." },
      { u: 2, content: "Any recommendations for books that reward slow reading? Most contemporary stuff is written to be consumed, not savored." },
      { u: 0, content: "Anything by Marilynne Robinson. Gilead especially. Every sentence is doing three things at once." },
      { u: 1, content: "Just finished Gilead actually. Sat with the last page for about 20 minutes before closing it." },
    ],
  },
  {
    name: 'Algorithm-Free Zone',
    description: 'Discussing digital minimalism, attention, and the internet we actually want.',
    color: '#E8FF47', createdBy: 1,
    messages: [
      { u: 1, content: "Question for the group: what did you do with the time you reclaimed when you quit the algorithmic feeds?" },
      { u: 2, content: "Honestly? Stared at the wall a lot at first. Then started cooking properly. Then started writing again." },
      { u: 0, content: "I read more. Not just books — longer articles, things that took concentration. Forgot I used to like that." },
      { u: 1, content: "It's not just time stolen, it's the capacity for depth that atrophies." },
      { u: 2, content: "Reclaiming that capacity is slow. But it's the most worthwhile thing I've done online in years." },
      { u: 0, content: "And here we are on Yawp. Being weird and slow on purpose." },
    ],
  },
  {
    name: 'Morning Pages',
    description: 'A circle for daily writing practice. Share what you wrote about, not what you wrote.',
    color: '#7C4DFF', createdBy: 1,
    messages: [
      { u: 1, content: "Day 31. Still going. Today: a memory from age 9 I haven't thought about in years. Pages keep surfacing things." },
      { u: 0, content: "I started two weeks ago because of your posts about this. It's stranger than I expected. More honest." },
      { u: 2, content: "What time do you all write? I've been doing it at 6am but wondering if evening works too." },
      { u: 1, content: "Morning is the whole point for me — before the day has a chance to shape my thoughts." },
      { u: 0, content: "Morning. Always morning. Before my phone. Before coffee even. The first-draft brain." },
    ],
  },
]

async function getOrCreateUid(profile: typeof DEMO_PROFILES[number]): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, profile.email, profile.password)
    return cred.user.uid
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, profile.email, profile.password)
      return cred.user.uid
    }
    throw err
  }
}

async function seedAll(uids: string[]) {
  // Posts
  const postIds: string[] = []
  for (const p of SEED_POSTS) {
    const ref = await addDoc(collection(db, 'posts'), {
      userId: uids[p.u],
      content: p.content,
      tags: p.tags,
      heartCount: p.hearts,
      echoCount: 0,
      replyCount: 0,
      createdAt: daysAgo(p.ago),
    })
    postIds.push(ref.id)
  }

  // Replies
  const REPLIES = [
    { postIdx: 0,  u: 1, content: "Same experience. The silence when you first quit is uncomfortable — then it becomes the point.", ago: 2 },
    { postIdx: 0,  u: 2, content: "Six months off and I still feel the phantom reach for the app.", ago: 2 },
    { postIdx: 6,  u: 0, content: "Genuinely the most subversive thing a platform can do right now.", ago: 1 },
    { postIdx: 6,  u: 2, content: "Chronological is just… respecting the reader's time.", ago: 1 },
    { postIdx: 8,  u: 0, content: "Discovery vs delivery is a perfect framing. Going to be thinking about this one.", ago: 5 },
    { postIdx: 9,  u: 2, content: "This needs to be on a poster somewhere.", ago: 8 },
    { postIdx: 10, u: 0, content: "Written at 2am and it still hits. Thank you.", ago: 13 },
    { postIdx: 12, u: 1, content: "The first week is the hardest. After that you stop missing it and start missing the person you were before it.", ago: 2 },
    { postIdx: 16, u: 0, content: "This is why I'm here. A conversation, not a broadcast.", ago: 14 },
    { postIdx: 16, u: 1, content: "And here we are, having one.", ago: 14 },
  ]
  for (const r of REPLIES) {
    const postRef = doc(db, 'posts', postIds[r.postIdx])
    await addDoc(collection(postRef, 'replies'), {
      postId: postIds[r.postIdx],
      userId: uids[r.u],
      content: r.content,
      heartCount: Math.floor(Math.random() * 6),
      createdAt: daysAgo(r.ago),
    })
    await updateDoc(postRef, { replyCount: increment(1) })
  }

  // Circles
  for (const c of SEED_CIRCLES) {
    const circleRef = await addDoc(collection(db, 'circles'), {
      name: c.name,
      description: c.description,
      color: c.color,
      createdBy: uids[c.createdBy],
      memberCount: 3,
      createdAt: daysAgo(25),
    })
    let msgTime = daysAgo(20)
    for (const m of c.messages) {
      msgTime += Math.floor(Math.random() * 7_200_000) + 900_000
      await addDoc(collection(circleRef, 'messages'), {
        userId: uids[m.u],
        content: m.content,
        createdAt: msgTime,
      })
    }
  }

  // DM conversation between demo1 and demo2
  const convRef = await addDoc(collection(db, 'conversations'), {
    participants: [uids[0], uids[1]],
    lastMessage: 'And here we are.',
    lastMessageAt: daysAgo(1),
  })
  const DMS = [
    { sender: uids[0], text: "Hey — did you see Jordan's post about follower counts? Really well put.", ago: 3 },
    { sender: uids[1], text: "Yes! 'Leaderboards for a game nobody agreed to play' is going to live in my head for a while.", ago: 3 },
    { sender: uids[0], text: "I found this place through a blog post that called it 'the anti-Twitter.' Took me a week to understand why that was a compliment.", ago: 2 },
    { sender: uids[1], text: "Ha. Same. I kept looking for the engagement metrics and then slowly realized that was the whole point.", ago: 2 },
    { sender: uids[0], text: "And here we are.", ago: 1 },
  ]
  for (const dm of DMS) {
    await addDoc(collection(convRef, 'messages'), {
      conversationId: convRef.id,
      senderId: dm.sender,
      content: dm.text,
      readAt: null,
      createdAt: daysAgo(dm.ago),
    })
  }

  // Mutual follows between all three demo accounts
  // 0 ↔ 1, 0 ↔ 2, 1 ↔ 2
  const followPairs = [[0,1],[1,0],[0,2],[2,0],[1,2],[2,1]]
  const batch = writeBatch(db)
  for (const [a, b] of followPairs) {
    const now = daysAgo(15)
    batch.set(doc(db, 'profiles', uids[a], 'following', uids[b]), { followedAt: now })
    batch.set(doc(db, 'profiles', uids[b], 'followers', uids[a]), { followedAt: now })
  }
  await batch.commit()

  // Seed notifications for demo1 (alex) — hearts from Jordan & Taylor + a follow
  const notifBatch = writeBatch(db)
  // Jordan hearted alex's first post
  notifBatch.set(doc(db, 'notifications', uids[0], 'items', `heart_${postIds[0]}_${uids[1]}`), {
    type: 'heart',
    fromUserId: uids[1],
    fromUsername: DEMO_PROFILES[1].username,
    fromDisplayName: DEMO_PROFILES[1].displayName,
    postId: postIds[0],
    postContent: SEED_POSTS[0].content.slice(0, 80),
    createdAt: daysAgo(2),
    read: false,
  })
  // Taylor hearted alex's fourth post
  notifBatch.set(doc(db, 'notifications', uids[0], 'items', `heart_${postIds[3]}_${uids[2]}`), {
    type: 'heart',
    fromUserId: uids[2],
    fromUsername: DEMO_PROFILES[2].username,
    fromDisplayName: DEMO_PROFILES[2].displayName,
    postId: postIds[3],
    postContent: SEED_POSTS[3].content.slice(0, 80),
    createdAt: daysAgo(8),
    read: false,
  })
  // Jordan followed alex
  notifBatch.set(doc(db, 'notifications', uids[0], 'items', `follow_${uids[1]}`), {
    type: 'follow',
    fromUserId: uids[1],
    fromUsername: DEMO_PROFILES[1].username,
    fromDisplayName: DEMO_PROFILES[1].displayName,
    createdAt: daysAgo(15),
    read: false,
  })
  // Taylor followed alex
  notifBatch.set(doc(db, 'notifications', uids[0], 'items', `follow_${uids[2]}`), {
    type: 'follow',
    fromUserId: uids[2],
    fromUsername: DEMO_PROFILES[2].username,
    fromDisplayName: DEMO_PROFILES[2].displayName,
    createdAt: daysAgo(14),
    read: false,
  })
  await notifBatch.commit()
}

/**
 * Signs in the demo account, seeding all content on first use.
 * Subsequent calls skip seeding (fast path).
 */
export async function launchDemo(): Promise<void> {
  const uid0 = await getOrCreateUid(DEMO_PROFILES[0])

  const profileDoc = await getDoc(doc(db, 'profiles', uid0))
  const postsSnap = await getDocs(
    query(collection(db, 'posts'), where('userId', '==', uid0), limit(1))
  )

  const needsSeed = !profileDoc.exists() || postsSnap.empty

  if (needsSeed) {
    await auth.signOut()

    const uids: string[] = []
    for (const profile of DEMO_PROFILES) {
      const uid = await getOrCreateUid(profile)
      await setDoc(doc(db, 'profiles', uid), {
        uid,
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: null,
        isPlus: false,
        createdAt: daysAgo(30),
        isDemo: true,
      })
      await auth.signOut()
      uids.push(uid)
    }

    // Sign in as demo1 before seeding so all Firestore writes are authenticated
    await signInWithEmailAndPassword(auth, DEMO_CREDS.email, DEMO_CREDS.password)
    await seedAll(uids)
  } else {
    // Fast path: ensure demo1 is signed in (getOrCreateUid already did this,
    // but be explicit in case auth state is stale)
    await signInWithEmailAndPassword(auth, DEMO_CREDS.email, DEMO_CREDS.password)
  }
}
