import ipaddress
import json
import re
import socket
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


MAX_HTML_BYTES = 3_000_000
TIMEOUT_SECONDS = 20
USER_AGENT = "ExtratorBeautifulSoup/1.0 (+https://replit.com)"
DETAIL_FALLBACK_SELECTORS = (
    "#layout > div.pure-g.template-center > div > "
    "div.template-middle.pure-u-1-3 > div.site-content > p:first-of-type",
    ".template-middle .site-content > p:first-of-type",
)


def fail(message: str, status: int = 400) -> None:
    print(json.dumps({"ok": False, "error": message, "status": status}))
    sys.exit(0)


def validate_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        fail("Informe uma URL pública começando com http:// ou https://.")

    hostname = parsed.hostname.lower().rstrip(".")
    if hostname in {"localhost", "localhost.localdomain"}:
        fail("Por segurança, endereços locais não podem ser consultados.")

    try:
        addresses = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        fail("Não foi possível encontrar o endereço informado.", 502)

    for address in {item[4][0] for item in addresses}:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            fail("Por segurança, endereços de rede privada não podem ser consultados.")

    return raw_url


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    return " ".join(value.split()) or None


def read_value(node, attribute: str) -> str | None:
    if attribute == "text":
        return clean_text(node.get_text(" ", strip=True))
    if attribute == "value":
        return clean_text(node.get("value"))
    return clean_text(node.get(attribute))


def read_field_value(node, field: dict) -> str | None:
    value = read_value(node, field.get("attribute", "text"))
    if field.get("key") == "chassi" and value:
        return value.replace("*", "")
    return value


def select_field_matches(root, field: dict) -> list:
    matches = root.select(field["selector"])
    if matches or field.get("key") != "detalhe":
        return matches

    for fallback_selector in DETAIL_FALLBACK_SELECTORS:
        fallback_matches = root.select(fallback_selector)
        if fallback_matches:
            return fallback_matches

    detail_matches = [
        paragraph
        for paragraph in root.select("p")
        if re.search(
            r"\bfinal\s+de\s+chassi\b",
            clean_text(paragraph.get_text(" ", strip=True)) or "",
            flags=re.IGNORECASE,
        )
    ]
    if detail_matches:
        return detail_matches[:1]
    return matches


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        url = validate_public_url(payload["url"])
        fields = payload["fields"]
        item_selector = payload.get("itemSelector")

        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            timeout=TIMEOUT_SECONDS,
            stream=True,
        )
        response.raise_for_status()

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_HTML_BYTES:
            fail("A página é maior que o limite de 3 MB.", 400)

        chunks = []
        total = 0
        for chunk in response.iter_content(chunk_size=64 * 1024):
            total += len(chunk)
            if total > MAX_HTML_BYTES:
                fail("A página é maior que o limite de 3 MB.", 400)
            chunks.append(chunk)

        html = b"".join(chunks)
        if (urlparse(response.url).hostname or "").lower().rstrip(".") in {
            "dadosdaplaca.com.br",
            "www.dadosdaplaca.com.br",
        }:
            time.sleep(4)

        soup = BeautifulSoup(html, "html.parser")
        warnings: list[str] = []
        columns = [field["key"] for field in fields]
        rows: list[dict[str, str | None]] = []

        if item_selector:
            try:
                items = soup.select(item_selector)
            except Exception as error:
                fail(f"Seletor de itens inválido: {error}")
            if not items:
                warnings.append(f"Nenhum item encontrado para “{item_selector}”.")
            for item in items:
                row: dict[str, str | None] = {}
                for field in fields:
                    try:
                        match = item.select_one(field["selector"])
                    except Exception as error:
                        fail(f"Seletor inválido em “{field['key']}”: {error}")
                    row[field["key"]] = read_field_value(match, field) if match else None
                rows.append(row)
        else:
            matches_by_field: dict[str, list] = {}
            for field in fields:
                try:
                    matches = select_field_matches(soup, field)
                except Exception as error:
                    fail(f"Seletor inválido em “{field['key']}”: {error}")
                matches_by_field[field["key"]] = matches
                if not matches:
                    warnings.append(f"Nenhum elemento encontrado para “{field['key']}”.")

            row_count = max(
                (len(matches) for matches in matches_by_field.values()),
                default=0,
            )
            for index in range(row_count):
                row = {}
                for field in fields:
                    matches = matches_by_field[field["key"]]
                    node = matches[index] if index < len(matches) else None
                    row[field["key"]] = read_field_value(node, field) if node else None
                rows.append(row)

        title = clean_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
        print(
            json.dumps(
                {
                    "ok": True,
                    "data": {
                        "url": response.url,
                        "title": title or "Página sem título",
                        "fetchedAt": datetime.now(timezone.utc).isoformat(),
                        "count": len(rows),
                        "columns": columns,
                        "rows": rows,
                        "warnings": warnings,
                    },
                },
                ensure_ascii=False,
            )
        )
    except requests.RequestException as error:
        fail(f"Não foi possível carregar a página: {error}", 502)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        fail("Os dados enviados para a extração são inválidos.")
    except Exception as error:
        fail(f"Erro inesperado durante a extração: {error}", 502)


if __name__ == "__main__":
    main()