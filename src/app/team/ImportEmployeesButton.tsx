"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileDown } from "lucide-react"
import { toast } from "sonner"

export function ImportEmployeesButton({ onRefresh }: { onRefresh: () => void }) {
  const [importing, setImporting] = useState(false)

  const handleDownloadTemplate = () => {
    const headers = "Name,Email,Role,DepartmentName,JoinDate(YYYY-MM-DD),OpeningPL,OpeningCL\n"
    const sample = "Alice Smith,alice@example.com,EMPLOYEE,Engineering,2024-01-01,5,7\n"
    const blob = new Blob([headers + sample], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_import_template.csv'
    a.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const lines = text.split("\n").filter(l => l.trim() !== "").slice(1) // Skip header
      
      let successCount = 0
      let failCount = 0

      for (const line of lines) {
        const [name, email, role, dept, joinDate, opPl, opCl] = line.split(",").map(s => s.trim())
        if (!email) continue

        try {
          const res = await fetch("/api/team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              name, email, role, joinDate, 
              openingPl: opPl, openingCl: opCl,
              departmentName: dept, // The API would need to handle dept name lookup if we want to be fancy
              departmentId: "clv8p2q9m000108l4g7n7v9r6" // Placeholder or handle lookup
            }),
          })
          if (res.ok) successCount++
          else failCount++
        } catch {
          failCount++
        }
      }

      toast.success(`Import complete: ${successCount} successful, ${failCount} failed.`)
      onRefresh()
      setImporting(false)
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
        <FileDown className="w-4 h-4 mr-2" /> Template
      </Button>
      <div className="relative">
        <Button variant="outline" size="sm" disabled={importing}>
          <Upload className="w-4 h-4 mr-2" /> {importing ? "Importing..." : "Import CSV"}
        </Button>
        <input 
          type="file" 
          accept=".csv"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={handleFileChange}
          disabled={importing}
        />
      </div>
    </div>
  )
}
