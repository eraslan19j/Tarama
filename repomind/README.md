# RepoMind

RepoMind, bir yazılım projesini otomatik olarak tarar ve kod kalitesi, proje yapısı ve güvenlik konularında ayrıntılı raporlar oluşturan profesyonel bir CLI (komut satırı) aracıdır.

## Özellikler

- **Çok dilli destek**: Python, Kotlin, Java, JavaScript, TypeScript, XML, JSON, Gradle, Markdown
- **Kod istatistikleri**: Satır sayısı, kod/boş/yorum satırları, fonksiyon/class/import sayıları
- **Desen tespiti**: TODO, FIXME, HACK, XXX, deprecated API'ler, sabit URL'ler, sabit API anahtarları
- **Karmaşıklık analizi**: Fonksiyon bazlı yaklaşık cyclomatic complexity hesaplama
- **Duplicate kod tespiti**: Normalize edilmiş token/line tabanlı algoritma
- **Bağımlılık analizi**: Gradle/Kotlin `implementation`, `api`, `kapt`, `ksp`, `testImplementation` desteği
- **Proje yapısı analizi**: Önemli klasörleri ve dosyaları tespit etme
- **Risk sistemi**: LOW, MEDIUM, HIGH, CRITICAL seviyeleri
- **JSON çıktı**: Makine tarafından okunabilir rapor
- **Git desteği**: Repository URL'si vererek otomatik klonlama
- **Termux uyumlu**: Python 3 standard library kullanır, harici paket gerektirmez

## Kurulum

RepoMind sadece Python 3 standart kütüphanesini kullanır. Ek bir kurulum gerektirmez.

```bash
# Termuxda doğrudan kullanım
python3 repomind.py /path/to/project

# Veya sistem yoluna ekleyerek
chmod +x repomind.py
cp repomind.py ~/repomind
repomind /path/to/project
```

GitHub'dan çekmek için Termuxda:

```bash
pkg install git
git clone https://github.com/eraslan19j/Tarama.git
cd Tarama/repomind
python3 repomind.py /sdcard/your_project --all
```

## Kullanım

### Temel Kullanım

```bash
# Tüm analizleri çalıştır (varsayılan)
python3 repomind.py /path/to/project

# Belirli analizleri çalıştır
python3 repomind.py /path/to/project --stats --complexity

# Git repository URL'si ile kullanım
python3 repomind.py https://github.com/user/repository.git --all
```

### CLI Seçenekleri

| Seçenek | Açıklama |
|---------|----------|
| `--stats` | Dosya istatistiklerini toplar (satır, fonksiyon, class, import sayıları) |
| `--security` | Sabit URL ve API anahtarlarını tespit eder |
| `--duplicates` | Duplicate kod bloklarını tespit eder |
| `--complexity` | Cyclomatic complexity analizi yapar |
| `--dependencies` | Gradle/Kotlin bağımlılıklarını analiz eder |
| `--todos` | TODO/FIXME/HACK/XXX ve diğer işaretleri tespit eder |
| `--all` | Tüm analizleri çalıştırır |
| `--json FILE` | Raporu belirtilen dosyaya JSON formatında yazar |
| `--include-hidden` | Gizli klasörleri ve dosyaları dahil eder |
| `--include-build` | Derleme çıktı klasörlerini dahil eder (node_modules, build, vb.) |
| `--verbose, -v` | Ayrıntılı çıktı |
| `--quiet, -q` | Gereksiz çıktıyı bastırır |

### Örnekler

```bash
# Temel kullanım
python3 repomind.py ./my-project

# JSON raporu ile çalıştırma
python3 repomind.py ./my-project --all --json report.json

# Belirli analizler
python3 repomind.py ./my-project --stats --dependencies --json deps.json

# Gizli dosyaları ve build klasörlerini dahil etme
python3 repomind.py ./my-project --all --include-hidden --include-build

# Git repository'si analiz etme
python3 repomind.py https://github.com/user/repo.git --all --json report.json
```

## JSON Formatı

JSON raporu aşağıdaki yapıyı içerir:

```json
{
  "summary": {
    "files": 184,
    "scanned_files": 184,
    "skipped_files": 0,
    "lines": 42381,
    "classes": 97,
    "functions": 421,
    "total_issues": 134,
    "risk_breakdown": {
      "CRITICAL": 2,
      "HIGH": 14,
      "MEDIUM": 37,
      "LOW": 81
    }
  },
  "files": [...],
  "issues": [...],
  "duplicates": [...],
  "dependencies": {...},
  "project_structure": {...},
  "top_complex_functions": [...]
}
```

## Exit Code'ları

| Code | Açıklama |
|------|----------|
| 0 | Başarılı, kritik risk yok |
| 1 | Hata (geçersiz yol, klonlama hatası, vb.) |
| 2 | Kritik risk bulundu (CRITICAL seviyesinde sorunlar var) |

## Desteklenen Dosya Türleri

- `.kt`, `.kts` — Kotlin
- `.java` — Java
- `.py` — Python
- `.js`, `.jsx` — JavaScript
- `.ts`, `.tsx` — TypeScript
- `.xml` — XML
- `.json` — JSON
- `.gradle` — Gradle (Groovy DSL)
- `.md` — Markdown

## Varsayılan Olarak Hariç Tutulanlar

Aşağıdaki klasörler varsayılan olarak analiz dışındadır:

```
.git, build, node_modules, .gradle, .idea, target, __pycache__,
.venv, venv, dist, .mvn, .cache
```

`--include-build` seçeneği ile bu klasörler dahil edilebilir. Ayrıca symlink'ler de varsayılan olarak hariç tutulur.

## Mimari

RepoMind, tek bir Python dosyası (`repomind.py`) içinde modüler bir mimari ile geliştirilmiştir.

```
repomind/
├── repomind.py              # Tek dosyalık uygulama (tüm modüller)
├── README.md
├── .gitignore
├── tests/
│   ├── __init__.py
│   ├── test_repomind.py    # Tüm unit testler
│   └── test_data/
│       └── sample_project/  # Test veri klasörü
```

### Modüller

1. **LanguageDefinition / LanguageRegistry**: Desteklenen dillerin yorum stili, fonksiyon/class/import pattern'leri ve karmaşıklık anahtar kelimelerini tanımlar.

2. **LineClassifier**: Her satırı `CODE`, `COMMENT` veya `BLANK` olarak sınıflandırır. Çok satırlı yorum (`/* */`), triple-quote (`"""`) ve tek satırlık yorum (`//`, `#`) desteği.

3. **FileParser**: Tek bir dosyayı parse eder ve aşağıdaki metrikleri toplar:
   - Satır sayıları (toplam/kod/boş/yorum)
   - Fonksiyon ve class sayıları
   - Import sayısı
   - Fonksiyon karmaşıklığı (cyclomatic complexity)
   - Desin tespiti (TODO, FIXME, deprecated API, sabit URL/key)

4. **DuplicateDetector**: Normalize edilmiş n-gram hashing algoritması kullanarak duplicate kodu tespit eder.

5. **ComplexityAnalyzer**: En karmaşık fonksiyonları raporlar.

6. **DependencyAnalyzer**: Gradle/Kotlin bağımlılık bildirimlerini (`implementation`, `api`, `kapt`, `ksp`, vb.) tespit eder.

7. **StructureAnalyzer**: Proje klasör yapısını, önemli dizinleri ve dosyaları analiz eder.

8. **RiskAssessor**: Her bulguya risk seviyesi atar ve genel risk seviyesini hesaplar.

9. **ReportGenerator**: Terminal ve JSON raporları üretir.

10. **ProjectScanner**: Proje tarayıcısı — tüm dosyaları tarar, çıkarma yapılandırmalarını uygular ve analiz sonuçlarını toplar.

11. **GitCloner**: Git repository URL'lerini geçici klasöre klonlar.

### Duplicate Detection Algoritması

1. Her satır tokenize ederek normalize edilir:
   - Whitespace tekilleştirilir
   - String literalleri `"STR"` / `'STR'` ile değiştirilir
   - Sayılar `NUM` ile değiştirilir
   - Tanımlar (değişken/fonksiyon isimleri) `VAR` ile değiştirilir
   - Noktalama işaretleri normalize edilir
2. Belirli bir boyutta (pencere) kayan bir pencere oluşturulur
3. Her pencere için MD5 hash hesaplanır
4. Aynı hash değere sahip pencereler gruplanır
5. En az 2 kez eşleşen gruplar duplicate olarak rapor edilir

### Cyclomatic Complexity Hesaplama

- Baz karmaşıklık: 1
- Her karar noktası için +1: `if`, `elif`, `else if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `?:`, `switch`
- Fonksiyon gövdesi (başlangıçtan bitişe kadar) analiz edilir

## Test

```bash
# Tüm testleri çalıştır
python3 -m unittest discover

# Detaylı çıktı
python3 -m unittest discover -v
```

Test kapsamı:
- Parser testleri (Python, Kotlin, JavaScript, JSON, Markdown)
- Risk detector testleri
- Duplicate detector testleri
- CLI testleri
- Pattern detection testleri
- Complexity analyzer testleri
- Dependency analyzer testleri
- Structure analyzer testleri
- Project scanner testleri
