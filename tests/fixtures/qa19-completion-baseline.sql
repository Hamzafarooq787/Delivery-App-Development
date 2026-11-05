CREATE OR REPLACE FUNCTION public.complete_order_with_otp(p_id uuid, p_driver uuid, p_code text, p_photo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o delivery_requests%rowtype; code delivery_otps%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or length(coalesce(p_photo,''))=0 then return jsonb_build_object('error','Order is not ready for completion'); end if;
 select * into code from delivery_otps where delivery_id=p_id for update;
 if o.status='delivered' and code.verified_at is not null and trim(p_code)=code.otp then return jsonb_build_object('success',true); end if;
 if o.status<>'in_transit' or (o.service_type='buy_for_me' and (o.bfm_stage is distinct from 'heading_to_customer' or o.receipt_url is null or o.purchase_confirmed_at is null)) then return jsonb_build_object('error','Order is not ready for completion'); end if;
 if code.delivery_id is null or code.attempts>=5 then return jsonb_build_object('error','Contact support for a new delivery code'); end if;
 if trim(p_code) is distinct from code.otp then
  update delivery_otps set attempts=attempts+1 where delivery_id=p_id;
  return jsonb_build_object('error','Incorrect delivery code','attemptsRemaining',greatest(0,4-code.attempts));
 end if;
 update delivery_requests set status='delivered',delivered_at=now(),delivered_image_url=p_photo,
 bfm_stage=case when service_type='buy_for_me' then 'delivered' else bfm_stage end where id=p_id;
 update delivery_otps set verified_at=now() where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'delivered',p_driver);
 delete from driver_locations where driver_id=p_driver and delivery_id=p_id;
 return jsonb_build_object('success',true);
end $function$;
