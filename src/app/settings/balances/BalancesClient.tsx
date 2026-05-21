"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, Check, X, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

type UserBalance = {
  id: string
  name: string
  email: string
  department: string
  openingPl: number
  openingCl: number
  openingComp: number
  currentPl: number
  currentCl: number
}

export function BalancesClient({ initialUsers }: { initialUsers: UserBalance[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<UserBalance>>({})
  const [saving, setSaving] = useState(false)

  const handleEdit = (user: UserBalance) => {
    setEditingId(user.id)
    setEditData({
      openingPl: user.openingPl,
      openingCl: user.openingCl,
      openingComp: user.openingComp
    })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditData({})
  }

  const handleSave = async (userId: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/balances", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...editData }),
      })
      if (res.ok) {
        toast.success("Balances updated successfully")
        setUsers(users.map(u => u.id === userId ? { ...u, ...editData } as UserBalance : u))
        setEditingId(null)
      } else {
        toast.error("Failed to update balances")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Opening PL</TableHead>
              <TableHead>Opening CL</TableHead>
              <TableHead>Opening Comp</TableHead>
              <TableHead>Current PL</TableHead>
              <TableHead>Current CL</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={editData.openingPl}
                      onChange={(e) => setEditData({ ...editData, openingPl: parseFloat(e.target.value) })}
                    />
                  ) : user.openingPl}
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={editData.openingCl}
                      onChange={(e) => setEditData({ ...editData, openingCl: parseFloat(e.target.value) })}
                    />
                  ) : user.openingCl}
                </TableCell>
                <TableCell>
                  {editingId === user.id ? (
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={editData.openingComp}
                      onChange={(e) => setEditData({ ...editData, openingComp: parseFloat(e.target.value) })}
                    />
                  ) : user.openingComp}
                </TableCell>
                <TableCell className="text-slate-500 font-mono">{user.currentPl}</TableCell>
                <TableCell className="text-slate-500 font-mono">{user.currentCl}</TableCell>
                <TableCell className="text-right">
                  {editingId === user.id ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                        <X className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleSave(user.id)} disabled={saving} className="bg-green-600 hover:bg-green-700">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                      <Edit2 className="w-4 h-4 text-slate-400" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
