'use client'
import {useEffect,useRef} from 'react'
import {cleanupAbandonedOrderPhotos} from '@/app/actions/order-photo-cleanup'
/** Best effort on explicit close; a guarded 48-hour sweep recovers aborted requests. */
export function useOrderPhotoCleanup(urls:string[]){
 const photos=useRef(urls);photos.current=urls
 useEffect(()=>{void cleanupAbandonedOrderPhotos([],true).catch(()=>{});return()=>{void cleanupAbandonedOrderPhotos(photos.current).catch(()=>{})}},[])
}
