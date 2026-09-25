import { PlayerFollowList } from '../PlayerFollowList'

export default async function ProfileFollowingPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  return <PlayerFollowList username={username} kind="following" />
}
