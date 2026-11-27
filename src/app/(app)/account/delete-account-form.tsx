"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAccount, type DeleteAccountState } from "./actions";
import { DELETE_CONFIRMATION } from "./delete-confirmation";

const initial: DeleteAccountState = { error: null };

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="confirm-delete" className="block text-sm font-bold">
        Gõ <span className="text-destructive">{DELETE_CONFIRMATION}</span> để xác nhận
      </label>
      <input
        id="confirm-delete"
        name="confirm"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        className="bg-card focus-visible:border-destructive h-11 w-full max-w-sm rounded-2xl border-2 px-4 font-semibold outline-none"
      />
      <div>
        <Button type="submit" variant="destructive" disabled={pending || typed !== DELETE_CONFIRMATION}>
          <Trash2 aria-hidden="true" /> {pending ? "Đang xoá..." : "Xoá vĩnh viễn tài khoản"}
        </Button>
      </div>
      {state.error ? <p role="alert" className="text-destructive text-sm font-bold">{state.error}</p> : null}
    </form>
  );
}
