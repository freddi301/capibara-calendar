import { http, HttpResponse } from 'msw'

export function davHandler(
  method: string,
  url: string,
  body: string,
  init: { status?: number } = {},
) {
  return http.all(url, ({ request }) => {
    if (request.method !== method) return
    return new HttpResponse(body, {
      status: init.status ?? 207,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  })
}
