import { redirect } from "next/navigation";

export default function ManageRootPage() {
  redirect("/manage/login");
}
