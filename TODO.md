# Spin Balance — Yapılacaklar

## Android kimlik ve release paketi

- [x] **Uygulama adı ve paket kimliği** — “uygulamanın adını \"Spin Balance\" olarak düzeltelim. \"com.mscsi.spinbalance\" olsun kimliği.” Expo uygulama adı ile iOS bundle ve Android package kimliği `Spin Balance` / `com.mscsi.spinbalance` olarak ayarlandı.
- [x] **Tek başına çalışan release APK ve boyut düşüşü** — “uygulama boyutu neden 135mb, bu çok fazla değil mi?” Eski debug APK `141,466,726` byte (`134.91 MiB`) idi; 32-bit ve 64-bit native kütüphaneleri içeriyor ve Android JS bundle'ı yoktu. R8/resource shrink içeren standalone Release APK üretildi: `70,434,481` byte (`67.17 MiB`), önceki APK'dan `%50.2` daha küçük. `assets/index.android.bundle` içinde `4,048,760` byte'lık JS bundle doğrulandı; APK hem `arm64-v8a` hem de `armeabi-v7a` desteğini koruyor. CI artifact'ı `spinbalance-android-release-apk` adıyla 14 gün saklıyor.
- [ ] **Kullanıcının telefonunda açılış teyidi** — “uygulamayı telefona kurdum ama splash screen'de kalıyor.” Yeni APK release modunda JS bundle taşıyor; fiziksel telefon üzerinde bu oturumda kurup çalıştırma teyidi yapılamadı. Eski debug ve yeni Release APK farklı CI anahtarlarıyla imzalandıysa güncelleme reddedilebilir; böyle durumda eski uygulamayı kaldırıp yeni APK'yı kurun ve açılışı doğrulayın.

## CI derleme ve uygulama ikonu

- [x] **Android-only GitHub Actions derlemesi** — “iOS derlemesi gereksiz, workflow'dan kaldırabilirsin.” `.github/workflows/native-build.yml`, push/PR ve manuel çalıştırmada Android Release APK üretip 14 gün saklanan artifact olarak yükler; iOS derlemesi çalıştırmaz.
- [x] **Sağlanan görseli uygulama ikonu olarak kullanma** — “uygulama ikonu olarak bunu set edebilirsin.” Kullanıcının `SpinBalanceRotorAnalysis.png` görseli `icon.png`, Android adaptive foreground, splash ve favicon dosyalarına uygulanır; Android monochrome varlığı da aynı görselden türetilir.

## Kamera önizlemesi ve ölçüm hazırlığı

- [x] **Kamera önizlemesi ve kalibrasyon** — “Telefon kamerasına erişim ve canlı görüntü önizlemesi”; “Dönen cismin kadraj içinde konumlandırılması için hizalama ve çekim yönergeleri”; “Ölçüm öncesi kısa kamera ve ölçek kalibrasyon akışı”. Kamera izni, canlı önizleme, kullanıcı dokunuşuyla mil merkezi seçimi ve isteğe bağlı rotor çapı girişi eklendi.

## Görsel ölçüm

- [ ] **Görüntüden gerçek balans noktası çıkarımı** — “Görüntüde dönen cismin ve referans merkezinin tespiti”; “Hareketin kareler boyunca izlenerek dönüş ekseni ile sapmanın analiz edilmesi”; “Tespit edilen balans noktasının canlı kamera görüntüsü üzerinde işaretlenmesi”; “Dengesizlik yönü ve göreli şiddetinin sade bir sonuç göstergesiyle sunulması”. Mevcut sürüm yeşil bir referans işaretini ve kullanıcının elle işaretlediği merkezi izleyerek görünür radyal yörünge kaçıklığını hesaplıyor ve optik sapma yönünü işaretliyor. Kamera görüntüsü tek başına gizli kütle dağılımını kanıtlamadığından gerçek ağır tarafı, balans ağırlığı veya endüstriyel düzeltme noktası çıkarımı tamamlanmış değildir; uygulama sonucu da bu şekilde sunmuyor.

## Uyarılar ve sonuç akışı

- [x] **Ölçüm durumu, uyarılar ve tekrar** — “Yetersiz ışık, aşırı titreşim veya uygun olmayan kadraj için gerçek zamanlı uyarılar”; “Ölçümü yeniden başlatma ve son sonucu özet ekranında görüntüleme”. Düşük ışık, görünmeyen referans, uygunsuz kadraj ve yüksek işaret-yörünge saçılımı için canlı uyarılar; durdurma, tekrar başlatma ve özet ekranı eklendi. Yüksek saçılım uyarısı doğrudan ivme sensörüyle ölçülen titreşim değil, optik kararsızlık göstergesidir.
