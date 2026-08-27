import { Router } from "express";
import { z } from "zod";
import { requireAdmin, writeAuditLog } from "../auth";
import { serviceUnavailable, supabaseRequest } from "../db";
export const adminSettingsRouter=Router(); adminSettingsRouter.use(requireAdmin);
adminSettingsRouter.put("/",async(req,res)=>{const p=z.object({key:z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/),value:z.unknown()}).safeParse(req.body);if(!p.success){res.status(400).json({error:"Invalid settings payload."});return;}try{const out=await supabaseRequest("store_settings",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({key:p.data.key,value:p.data.value,updated_at:new Date().toISOString()})});await writeAuditLog("settings.update",req.admin?.id,{key:p.data.key});res.json(out);}catch(e){res.status(serviceUnavailable(e)?503:500).json({error:"Unable to save settings."});}});
