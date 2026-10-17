import { handleExtraction } from "@/lib/saude/ocr/route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleExtraction(request, (await params).id, "aso");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleExtraction(request, (await params).id, "aso");
}
