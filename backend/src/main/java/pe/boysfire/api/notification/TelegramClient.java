package pe.boysfire.api.notification;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Cliente mínimo de la Bot API de Telegram. Solo lo que el sistema usa: enviar mensajes con
 * botones, leer actualizaciones y confirmar la pulsación de un botón.
 *
 * <p>El token va en la ruta de cada petición: los errores se devuelven sin la URL, para que el
 * token nunca termine en un registro ni en la base de datos.
 */
@Component
public class TelegramClient {

    private final RestClient http;
    private final TelegramProperties properties;

    TelegramClient(RestClient.Builder builder, TelegramProperties properties) {
        this.http = builder.baseUrl(properties.apiBaseUrl()).build();
        this.properties = properties;
    }

    /** Un botón de respuesta bajo el mensaje. */
    public record Button(String text, @JsonProperty("callback_data") String callbackData) {
    }

    /** Fallo al hablar con Telegram, ya sin datos sensibles. */
    public static class TelegramException extends RuntimeException {
        TelegramException(String message) {
            super(message);
        }
    }

    /** Envía un mensaje (HTML de Telegram) con una fila de botones por cada lista. Devuelve el id del mensaje. */
    public long sendMessage(long chatId, String html, List<List<Button>> keyboard) {
        SendMessage request = new SendMessage(chatId, html, "HTML", true,
                keyboard.isEmpty() ? null : Map.of("inline_keyboard", keyboard));
        Result<Message> response = call("sendMessage", request, new ParameterizedTypeReference<>() {});
        return response.result().messageId();
    }

    public List<Update> getUpdates(long offset) {
        Map<String, Object> request = Map.of("offset", offset, "timeout", 0, "allowed_updates", List.of("message", "callback_query"));
        return call("getUpdates", request, new ParameterizedTypeReference<Result<List<Update>>>() {}).result();
    }

    public void answerCallback(String callbackQueryId, String text) {
        call("answerCallbackQuery", Map.of("callback_query_id", callbackQueryId, "text", text),
                new ParameterizedTypeReference<Result<Boolean>>() {});
    }

    /** Nombre de usuario del bot (para armar enlaces t.me). */
    public Optional<String> botUsername() {
        if (!properties.enabled()) {
            return Optional.empty();
        }
        return Optional.ofNullable(call("getMe", Map.of(), new ParameterizedTypeReference<Result<User>>() {})
                .result().username());
    }

    private <T> Result<T> call(String method, Object body, ParameterizedTypeReference<Result<T>> type) {
        if (!properties.enabled()) {
            throw new TelegramException("Telegram no está configurado (falta TELEGRAM_BOT_TOKEN).");
        }
        try {
            Result<T> result = http.post()
                    .uri("/bot{token}/{method}", properties.botToken(), method)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(type);
            if (result == null || !result.ok()) {
                throw new TelegramException("Telegram rechazó " + method + ".");
            }
            return result;
        } catch (RestClientException exception) {
            throw new TelegramException("Error al llamar a Telegram (" + method + "): " + redact(exception.getMessage()));
        }
    }

    private String redact(String message) {
        return message == null ? "sin detalle" : message.replace(properties.botToken(), "***");
    }

    // ── Formas de las peticiones y respuestas de la Bot API ──────────────────

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record SendMessage(
            @JsonProperty("chat_id") long chatId,
            String text,
            @JsonProperty("parse_mode") String parseMode,
            @JsonProperty("disable_web_page_preview") boolean disablePreview,
            @JsonProperty("reply_markup") Object replyMarkup) {
    }

    record Result<T>(boolean ok, T result) {
    }

    public record User(long id, String username, @JsonProperty("first_name") String firstName) {
    }

    public record Chat(long id) {
    }

    public record Message(@JsonProperty("message_id") long messageId, Chat chat, User from, String text) {
    }

    public record CallbackQuery(String id, User from, Message message, String data) {
    }

    public record Update(
            @JsonProperty("update_id") long updateId, Message message, @JsonProperty("callback_query") CallbackQuery callbackQuery) {
    }
}
