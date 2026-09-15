import { Alert, Button, Stack, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import type { AuthFormStatus } from "./login-form.js";
export type RegisterValues = { name: string; email: string; password: string; confirmation: string };
export function RegisterForm({ error, status = "idle", onSubmit }: { readonly error?: string | undefined; readonly status?: AuthFormStatus; readonly onSubmit: (values: RegisterValues) => void | Promise<void> }) {
 const form=useForm<RegisterValues>(); const e=form.formState.errors; const submitting=status==="submitting"||form.formState.isSubmitting;
 const fields=[form.register("name",{required:"请输入姓名"}),form.register("email",{required:"请输入邮箱",pattern:{value:/^\S+@\S+$/,message:"请输入有效邮箱"}}),form.register("password",{required:"请输入密码",minLength:{value:8,message:"密码至少 8 位"}}),form.register("confirmation",{required:"请确认密码",validate:v=>v===form.getValues("password")||"两次输入的密码不一致。"})];
 const defs=[{label:"姓名",type:"text",autoComplete:"name"},{label:"邮箱",type:"email",autoComplete:"email"},{label:"密码",type:"password",autoComplete:"new-password"},{label:"确认密码",type:"password",autoComplete:"new-password"}];
 return <form noValidate onSubmit={(event)=>void form.handleSubmit((values)=>onSubmit(values))(event)}><Stack spacing={2.5}>{defs.map((d,i)=>{const reg=fields[i]!; const key=["name","email","password","confirmation"][i] as keyof RegisterValues; return <TextField key={key} {...reg} inputRef={reg.ref} {...d} label={d.label} error={Boolean(e[key])} helperText={e[key]?.message as string|undefined} fullWidth/>})}{error?<Alert severity="error">{error}</Alert>:null}<Button type="submit" variant="contained" fullWidth loading={submitting} disabled={submitting}>{submitting?"正在创建账号…":"创建账号"}</Button></Stack></form>;
}









