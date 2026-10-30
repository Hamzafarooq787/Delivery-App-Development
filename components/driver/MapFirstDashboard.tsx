'use client'

import { driverEarning } from "@/lib/driver-earnings"
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
} from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'
import { acceptDelivery } from '@/app/actions/delivery'
import { toggleDriverOnline } from '@/app/actions/driver'
import { PACKAGE_SIZE_INFO, isPackageSize } from '@/lib/vehicles'
import type { DashboardRoute, MapPoint } from './DriverDashboardMap'
import styles from './MapFirstDashboard.module.css'

const DashboardMap = dynamic(() => import('./DriverDashboardMap'), {
  ssr: false,
  loading: () => <div className={styles.mapMessage}>Loading map…</div>,
})
export type DashboardJob = {
  id: string
  status: string
  pickup_address: string | null
  delivery_address: string | null
  item_description: string | null
  driver_earning_quote?: number | null
  distance_miles?:number|null
  duration_min?:number|null
  shopping_items?:{name:string;quantity:number;brand_size_variant?:string;notes?:string}[]
  price: number | null
  package_size?: string | null
  service_type?: string | null
  shop_name?: string | null
}
const pounds = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    n,
  )

function decodePolyline(encoded: string): MapPoint[] {
  let index = 0,
    lat = 0,
    lng = 0
  const points: MapPoint[] = []
  const read = () => {
    let result = 0,
      shift = 0,
      value: number
    do {
      value = encoded.charCodeAt(index++) - 63
      result |= (value & 31) << shift
      shift += 5
    } while (value >= 32 && index < encoded.length)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < encoded.length) {
    lat += read()
    lng += read()
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

export function MapFirstDashboard({
  jobs,
  activeJobs,
  todayEarnings,
  completedToday,
  initialOnline,
  dataError,
}: {
  jobs: DashboardJob[]
  activeJobs: DashboardJob[]
  todayEarnings: number
  completedToday: number
  initialOnline: boolean
  dataError?: string
}) {
  const router = useRouter()
  const [onlineOverride, setOnlineOverride] = useState<{
    value: boolean
    source: boolean
  } | null>(null)
  const online =
    onlineOverride?.source === initialOnline
      ? onlineOverride.value
      : initialOnline
  const [onlinePending, startOnline] = useTransition()
  const [acceptPending, startAccept] = useTransition()
  const [selected, setSelected] = useState(0)
  const [declined, setDeclined] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [routeResult, setRouteResult] = useState<{
    id: string
    route: DashboardRoute | null
    failed?: boolean
  } | null>(null)
  const [location, setLocation] = useState<MapPoint | null>(null)
  const [locationStatus, setLocationStatus] = useState('Finding your location…')
  const [locationRequest, setLocationRequest] = useState(0)
  const [recenter, setRecenter] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const available = jobs.filter((j) => !declined.includes(j.id))
  const list = activeJobs.length ? activeJobs : available
  const index = Math.min(selected, Math.max(0, list.length - 1))
  const job = list[index] ?? null
  const isActive = activeJobs.length > 0
  const route =
    routeResult && job && routeResult.id === job.id ? routeResult.route : null
  const routeFailed =
    routeResult && job && routeResult.id === job.id && routeResult.failed

  useEffect(() => {
    // Refresh only server-owned data; never invent or locally claim jobs.
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [router])

  useEffect(() => {
    if (!job?.pickup_address || !job.delivery_address) return
    const controller = new AbortController()
    const id = job.id
    const params = new URLSearchParams({
      origin: job.pickup_address,
      destination: job.delivery_address,
    })
    fetch('/api/google/directions?' + params, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Route unavailable')
        return r.json()
      })
      .then((data) => {
        const result = data.routes?.[0],
          leg = result?.legs?.[0]
        if (!leg || !result.overview_polyline?.points)
          throw new Error('No driving route')
        setRouteResult({
          id,
          route: {
            pickup: leg.start_location,
            dropoff: leg.end_location,
            path: decodePolyline(result.overview_polyline.points),
            miles: leg.distance.value / 1609.344,
            minutes: Math.ceil(
              (leg.duration_in_traffic?.value ?? leg.duration.value) / 60,
            ),
          },
        })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setRouteResult({ id, route: null, failed: true })
      })
    return () => controller.abort()
  }, [job?.id, job?.pickup_address, job?.delivery_address])

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setLocationStatus('Location not supported'))
      return
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('Live location · centre map')
      },
      (error) => {
        setLocationStatus(
          error.code === 1
            ? 'Location blocked · check browser settings'
            : 'Location unavailable · retry',
        )
        setLocation(null)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [locationRequest])

  function locate() {
    setRecenter((v) => v + 1)
    if (!location) {
      setLocationRequest((v) => v + 1)
      setLocationStatus('Finding your location…')
    }
  }
  function toggleOnline() {
    const next = !online
    startOnline(async () => {
      try {
        const result = await toggleDriverOnline(next)
        if (result.error) {
          setMessage(result.error)
          return
        }
        setOnlineOverride({ value: next, source: initialOnline })
        setMessage('')
        router.refresh()
      } catch {
        setMessage('Could not update your status. Please try again.')
      }
    })
  }
  function accept() {
    if (!job || isActive) return
    startAccept(async () => {
      try {
        const result = await acceptDelivery(job.id)
        if (result?.error) {
          setMessage(result.error)
          router.refresh()
          return
        }
        router.push('/dashboard/driver/jobs/' + job.id)
        router.refresh()
      } catch {
        setMessage('Could not accept this job. Please try again.')
      }
    })
  }
  function decline() {
    if (job) {
      setDeclined((prev) => [...prev, job.id])
      setSelected(0)
      setMessage('Job skipped for this visit.')
    }
  }
  const vehicle =
    job?.package_size && isPackageSize(job.package_size)
      ? PACKAGE_SIZE_INFO[job.package_size].minVehicle
      : 'Suitable vehicle'
  // Display the immutable offer amount; historical orders retain their original policy.
  const payout =
    job ? driverEarning(job) : null
  return (
    <div className={styles.shell}>
      <section className={styles.mapArea} aria-label="Delivery route map">
        <div className={styles.mapCanvas}>
          <DashboardMap route={route} location={location} recenter={recenter} />
        </div>
        <div className={styles.hud}>
          <Link
            href="/dashboard/driver"
            className={styles.mobileLogo}
            aria-label="GoDrop driver home"
          >
            <BrandLogo />
          </Link>
          <div className={styles.stats}>
            <div>
              <span>Today</span>
              <strong>{pounds(todayEarnings)}</strong>
            </div>
            <div>
              <strong>{completedToday}</strong>
              <span>completed</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.online}
            data-online={online}
            role="switch"
            aria-checked={online}
            aria-label="Driver online status"
            disabled={onlinePending}
            onClick={toggleOnline}
          >
            <span className={styles.dot} />
            {onlinePending ? 'Updating…' : online ? 'Online' : 'Offline'}
            <span className={styles.switch} />
          </button>
        </div>
        <button type="button" className={styles.location} onClick={locate}>
          <Navigation size={12} style={{ display: 'inline', marginRight: 5 }} />
          {locationStatus}
        </button>
      </section>
      <section className={styles.panel} aria-label="Job offer">
        <div className={styles.handle} />
        <div className={styles.panelHeader}>
          <h1>{isActive ? 'Active Job' : 'Available Job'}</h1>
          <div className={styles.pager}>
            <button
              type="button"
              aria-label="Previous job"
              disabled={index === 0 || acceptPending}
              onClick={() => {
                setSelected(index - 1)
                setMessage('')
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {list.length ? `${index + 1} of ${list.length}` : '0 jobs'}
            </span>
            <button
              type="button"
              aria-label="Next job"
              disabled={index >= list.length - 1 || acceptPending}
              onClick={() => {
                setSelected(index + 1)
                setMessage('')
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {job ? (
          <>
            <div className={styles.route}>
              {[
                ['Pickup', job.shop_name || job.pickup_address],
                ['Dropoff', job.delivery_address],
              ].map(([label, address]) => (
                <div key={label} className={styles.stop}>
                  <span className={styles.stopIcon}>
                    <MapPin size={20} />
                  </span>
                  <div>
                    <small>{label}</small>
                    <strong title={address ?? ''}>
                      {address || 'Address unavailable'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.details}>
              <button
                type="button"
                className={`${styles.detailRow} ${styles.itemButton}`}
                onClick={() => dialog.current?.showModal()}
                aria-label="View item and address details"
              >
                <Box />
                <span>
                  <strong>
                    {job.service_type === 'buy_for_me'
                      ? 'Shopping items'
                      : 'Item details'}
                  </strong>
                  <small>
                    {job.service_type === 'buy_for_me'
                      ? 'Buy for Me'
                      : 'Collect & Deliver'}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
              <div className={`${styles.detailRow} ${styles.vehicleRow}`}>
                <Car />
                <span>
                  <strong>{vehicle}</strong>
                  <small>Vehicle required</small>
                </span>
              </div>
              <div className={`${styles.detailRow} ${styles.routeRow}`}>
                <Clock />
                <span>
                  <strong>
                    {job.distance_miles!=null ? `${Number(job.distance_miles).toFixed(1)} miles` : route
                      ? `${route.miles.toFixed(1)} miles`
                      : routeFailed
                        ? 'Route unavailable'
                        : 'Loading route…'}
                  </strong>
                  <small>
                    {job.duration_min!=null ? `${Math.ceil(job.duration_min)} min driving (est.)` : route
                      ? `${route.minutes} min (est.) · ${vehicle}`
                      : 'Driving distance'}
                  </small>
                </span>
              </div>
            </div>
            <div className={styles.payout}>
              <span>{isActive ? 'Your earnings' : 'Payout'}</span>
              <strong>{payout === null ? 'Not quoted' : pounds(payout)}</strong>
            </div>
            <div className={styles.actions}>
              {isActive ? (
                <Link
                  className={styles.primary}
                  href={'/dashboard/driver/jobs/' + job.id}
                >
                  Continue delivery
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={acceptPending || payout === null}
                    onClick={accept}
                  >
                    {acceptPending ? 'Accepting…' : 'Accept job'}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={acceptPending}
                    onClick={decline}
                  >
                    Decline
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <Box size={32} style={{ margin: 'auto' }} />
            <strong>
              {dataError ? 'Could not load jobs' : 'No available jobs'}
            </strong>
            <span>
              {dataError || 'New jobs will appear here when available.'}
            </span>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setDeclined([])
                setMessage('')
                router.refresh()
              }}
            >
              Refresh jobs
            </button>
            <Link
              className={styles.secondary}
              href="/dashboard/driver/jobs/available"
            >
              View all jobs
            </Link>
          </div>
        )}
        {message && (
          <p
            className={styles.notice}
            role={message.startsWith('Job skipped') ? 'status' : 'alert'}
          >
            {message}
          </p>
        )}
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby="job-detail-title"
        >
          <h2 id="job-detail-title">Job details</h2>
          <p>
            <strong>Pickup</strong>
            <br />
            {job?.pickup_address}
          </p>
          <p>
            <strong>Dropoff</strong>
            <br />
            {job?.delivery_address}
          </p>
          <p>
            <strong>Items</strong>
            <br />
            {job?.shopping_items?.length?job.shopping_items.map((item,i)=><span key={i} className="block">{item.quantity} × {item.name} {item.brand_size_variant??''}{item.notes?` · ${item.notes}`:''}</span>):job?.item_description || 'No further item details provided.'}
          </p>
          <p>
            <strong>Vehicle required</strong>
            <br />
            {vehicle}
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </dialog>
      </section>
    </div>
  )
}
