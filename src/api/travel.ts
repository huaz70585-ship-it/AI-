import { request } from '../utils/request'

// 旅程规划
export interface PlanTripParams {
  destination: string
  budget: string
  days: number
}

export interface Itinerary {
  id: string
  title: string
  summary: string
}

export function planTrip(data: PlanTripParams) {
  return request<Itinerary>({
    url: '/travel/plan',
    method: 'POST',
    data,
  })
}

// 热门目的地
export interface Destination {
  name: string
  image: string
  rating: number
  trend: number
  tag: string
  price: number
}

export function getPopularDestinations() {
  return request<Destination[]>({
    url: '/travel/destinations/popular',
    method: 'GET',
  })
}
