import { createClient } from '@/lib/supabase/server'
import { SearchClient } from './SearchClient'

export default async function SearchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let cityName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('city_name')
      .eq('id', user.id)
      .single()
    cityName = profile?.city_name ?? null
  }

  return <SearchClient user={user} userCityName={cityName} />
}
