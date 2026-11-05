# Spin Balance — Yapılacaklar

## Android kimlik ve yüklenebilir derleme

- [x] **Uygulama adı ve paket kimliği** — “uygulamanın adını \"Spin Balance\" olarak düzeltelim. \"com.mscsi.spinbalance\" olsun kimliği.” Expo uygulama adı ile iOS bundle ve Android package kimliği `Spin Balance` / `com.mscsi.spinbalance` olarak ayarlandı.
- [ ] **Tek başına açılan, daha küçük Android APK** — “uygulamayı telefona kurdum ama splash screen'de kalıyor.”; “uygulama boyutu neden 135mb, bu çok fazla değil mi?” Workflow `assembleRelease` ile JavaScript bundle'ı içeren standalone APK üretir; R8 minify ve kullanılmayan kaynakları küçültme etkinleştirildi; 32/64-bit uyumluluğu korunur. CI derlemesi ve APK'nın gerçek boyutu/telefonda Metro'suz açılışı henüz doğrulanmayı bekliyor.

## CI derleme ve uygulama ikonu

- [x] **Android-only GitHub Actions derlemesi** — “iOS derlemesi gereksiz, workflow'dan kaldırabilirsin.” `.github/workflows/native-build.yml`, push/PR ve manuel çalıştırmada Android release APK üretip 14 gün saklanan artifact olarak yükler; iOS derlemesi çalıştırmaz.
- [x] **Sağlanan görseli uygulama ikonu olarak kullanma** — “uygulama ikonu olarak bunu set edebilirsin.” Kullanıcının `SpinBalanceRotorAnalysis.png` görseli `icon.png`, Android adaptive foreground, splash ve favicon dosyalarına uygulanır; Android monochrome varlığı da aynı görselden türetilir.

## Kamera önizlemesi ve ölçüm hazırlığı

- [x] **Kamera önizlemesi ve kalibrasyon** — “Telefon kamerasına erişim ve canlı görüntü önizlemesi”; “Dönen cismin kadraj içinde konumlandırılması için hizalama ve çekim yönergeleri”; “Ölçüm öncesi kısa kamera ve ölçek kalibrasyon akışı”. Kamera izni, canlı önizleme, kullanıcı dokunuşuyla mil merkezi seçimi ve isteğe bağlı rotor çapı girişi eklendi.

## Görsel ölçüm

- [ ] **Görüntüden gerçek balans noktası çıkarımı** — “Görüntüde dönen cismin ve referans merkezinin tespiti”; “Hareketin kareler boyunca izlenerek dönüş ekseni ile sapmanın analiz edilmesi”; “Tespit edilen balans noktasının canlı kamera görüntüsü üzerinde işaretlenmesi”; “Dengesizlik yönü ve göreli şiddetinin sade bir sonuç göstergesiyle sunulması”. Mevcut sürüm yeşil bir referans işaretini ve kullanıcının elle işaretlediği merkezi izleyerek görünür radyal yörünge kaçıklığını hesaplıyor ve optik sapma yönünü işaretliyor. Kamera görüntüsü tek başına gizli kütle dağılımını kanıtlamadığından gerçek ağır tarafı, balans ağırlığı veya endüstriyel düzeltme noktası çıkarımı tamamlanmış değildir; uygulama sonucu da bu şekilde sunmuyor.

## Uyarılar ve sonuç akışı

- [x] **Ölçüm durumu, uyarılar ve tekrar** — “Yetersiz ışık, aşırı titreşim veya uygun olmayan kadraj için gerçek zamanlı uyarılar”; “Ölçümü yeniden başlatma ve son sonucu özet ekranında görüntüleme”. Düşük ışık, görünmeyen referans, uygunsuz kadraj ve yüksek işaret-yörünge saçılımı için canlı uyarılar; durdurma, tekrar başlatma ve özet ekranı eklendi. Yüksek saçılım uyarısı doğrudan ivme sensörüyle ölçülen titreşim değil, optik kararsızlık göstergesidir.
