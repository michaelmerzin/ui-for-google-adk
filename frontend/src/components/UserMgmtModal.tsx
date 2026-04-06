import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, Trash2, ShieldCheck, User as UserIcon } from "lucide-react";
import toast from "react-hot-toast";
import { usersApi, type UserOut } from "../api/client";
import { useAuthStore } from "../store/authStore";
import styles from "./Modal.module.css";

interface Props {
  onClose: () => void;
}

export default function UserMgmtModal({ onClose }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  const [formError, setFormError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setForm({ username: "", password: "", role: "user" });
      setFormError("");
      toast.success(`User "${form.username}" created`);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail ?? "Failed to create user");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User removed");
    },
    onError: () => toast.error("Failed to remove user"),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      usersApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      usersApi.update(id, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      setFormError("Username and password are required");
      return;
    }
    createMut.mutate();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <UserIcon size={16} />
            User Management
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Users table */}
        <div className={styles.tableWrap}>
          {isLoading ? (
            <div className={styles.loadingRow}>Loading…</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Sessions</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUser?.id}
                    onDelete={() => deleteMut.mutate(u.id)}
                    onToggleActive={() =>
                      toggleActiveMut.mutate({ id: u.id, is_active: !u.is_active })
                    }
                    onChangeRole={(role) => changeRoleMut.mutate({ id: u.id, role })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add user form */}
        <form className={styles.addForm} onSubmit={handleCreate}>
          <div className={styles.addFormTitle}>
            <UserPlus size={14} /> Add new user
          </div>
          {formError && <div className={styles.formError}>{formError}</div>}
          <div className={styles.addFormFields}>
            <input
              className={styles.addInput}
              placeholder="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
            <input
              className={styles.addInput}
              type="password"
              placeholder="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <select
              className={styles.addSelect}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className={styles.addBtn} disabled={createMut.isPending}>
              {createMut.isPending ? "Adding…" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onDelete,
  onToggleActive,
  onChangeRole,
}: {
  user: UserOut;
  isSelf: boolean;
  onDelete: () => void;
  onToggleActive: () => void;
  onChangeRole: (role: string) => void;
}) {
  return (
    <tr className={isSelf ? styles.selfRow : ""}>
      <td>
        <div className={styles.userCell}>
          <span className={`${styles.onlineDot} ${user.is_active ? styles.active : styles.inactive}`} />
          <strong>{user.username}</strong>
          {isSelf && <span className={styles.youBadge}>you</span>}
        </div>
      </td>
      <td>
        {isSelf ? (
          <span className={`${styles.roleBadge} ${user.role === "admin" ? styles.adminBadge : styles.userBadge}`}>
            {user.role}
          </span>
        ) : (
          <select
            className={styles.roleSelect}
            value={user.role}
            onChange={(e) => onChangeRole(e.target.value)}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        )}
      </td>
      <td className={styles.monoCell}>{user.session_count}</td>
      <td>
        {isSelf ? (
          <span className={styles.statusActive}>active</span>
        ) : (
          <button
            className={`${styles.statusToggle} ${user.is_active ? styles.statusActive : styles.statusInactive}`}
            onClick={onToggleActive}
          >
            {user.is_active ? "active" : "disabled"}
          </button>
        )}
      </td>
      <td className={styles.monoCell}>
        {user.last_login
          ? new Date(user.last_login).toLocaleDateString()
          : "never"}
      </td>
      <td>
        {!isSelf && (
          <button className={styles.deleteBtn} onClick={onDelete} title="Remove user">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}
