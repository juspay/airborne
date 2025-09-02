"use client"
import { View } from '@/app/dashboard/views/page'
import { apiFetch } from '@/lib/api';
import { useAppContext } from '@/providers/app-context';
import React, { useEffect } from 'react'

interface ViewReleaseInfo{
  view:View;
}

const ViewReleaseInfo:React.FC<ViewReleaseInfo> = ({ view }) => {

  const {token, org, app } = useAppContext();

  const fetchRelease = async ()=>{
    try{
      const res = await apiFetch(`/release/v2/${org}/${app}`,{},{token,org,app})
      console.log(res);
    }
    catch(err){
      console.log(err);
    }
  }

  useEffect(()=>{
    
    fetchRelease();
  },[token,org,app])



  return (
    <div>
      ViewReleaseInfo
    </div>
  )
}

export default ViewReleaseInfo