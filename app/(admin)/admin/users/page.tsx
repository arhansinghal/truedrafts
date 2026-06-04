import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, purchases, essays } from "@/lib/db/schema";
import { isNull, desc } from "drizzle-orm";
import { AdminUserRow } from "@/components/admin/UserRow";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users — Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const sp = await searchParams;
  const roleFilter = sp.role;

  const allUsers = await db.query.users.findMany({
    where: isNull(users.deletedAt),
    orderBy: [desc(users.createdAt)],
    limit: 100,
  });

  const filtered = roleFilter
    ? allUsers.filter((u) => u.role === roleFilter)
    : allUsers;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-2 mb-6">
        {[undefined, "reader", "writer", "admin"].map((r) => (
          <a
            key={r ?? "all"}
            href={r ? `/admin/users?role=${r}` : "/admin/users"}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              (roleFilter ?? undefined) === r
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {r ?? "All"}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((user) => (
              <AdminUserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-sm">No users found.</div>
        )}
      </div>
    </div>
  );
}
